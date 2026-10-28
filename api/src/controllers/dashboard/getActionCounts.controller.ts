import type { Request, Response } from 'express';
import {
  PurchaseOrder,
  PurchaseRequisition,
  RFQ,
  Quotation,
  StoreRequisition,
  Invoice
} from '../../models/index.js';
import { isProcurementHead } from '@fossil/shared';
import { listPendingAuthorizations } from '../../services/pendingAuthorization.service.js';
import { buildDepartmentFilter } from '../../lib/departmentScope.js';

/**
 * Counts of work waiting on the signed-in user, for the sidebar badges.
 *
 * One endpoint rather than one per tab: the sidebar polls this every minute for
 * every signed-in user, and eight separate requests a minute per user is a lot
 * of traffic for a number next to a menu item.
 *
 * Each count deliberately mirrors the filter of the page it sits beside — a
 * badge that disagrees with the list it links to is worse than no badge, since
 * it sends someone looking for work that is not there. Where a page's query
 * lives in another controller, the filter here is a copy of that one and the
 * comment says which.
 *
 * Returned as a map keyed by nav href so the sidebar needs no per-role mapping
 * of its own; a role that cannot see a tab simply never reads that key.
 */

const toIdString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

/**
 * Purchase orders awaiting this user's approval step.
 * Mirrors department/getPendingPoApprovals, finance/getPendingApprovals and
 * coo/getPendingApprovals — the three queues the Approvals page reads.
 */
async function countPendingApprovals(user: any): Promise<number> {
  const role = user?.role;

  if (role === 'finance') {
    return PurchaseOrder.countDocuments({
      status: { $in: ['pending_finance', 'pending_approvals'] },
      hodApproved: true,
      financeApproved: false,
      isDeleted: false
    });
  }

  if (role === 'coo') {
    return PurchaseOrder.countDocuments({
      status: { $in: ['pending_coo', 'pending_approvals'] },
      requiresCooApproval: true,
      hodApproved: true,
      financeApproved: true,
      cooApproved: false,
      isDeleted: false
    });
  }

  if (role === 'department_head') {
    // A requesting-department HOD only approves their own department's orders,
    // resolved through the requisitions belonging to that department.
    const deptId = toIdString(user?.department);
    const reqs = deptId
      ? await PurchaseRequisition.find({ department: deptId, isDeleted: false }).select('_id')
      : [];
    const reqIds: any[] = reqs.map((r) => r._id);

    if (isProcurementHead(user)) {
      // Their own department's first step, plus orders with no requisition,
      // which only the Head of Procurement may take.
      reqIds.push(null);
      return PurchaseOrder.countDocuments({
        isDeleted: false,
        $or: [
          { status: 'pending_proc_hod', procHodApproved: false },
          {
            status: { $in: ['pending_dept_hod', 'pending_hod', 'pending_approvals'] },
            deptHodApproved: false,
            purchaseRequisition: { $in: reqIds }
          }
        ]
      });
    }

    if (!deptId) return 0;
    return PurchaseOrder.countDocuments({
      isDeleted: false,
      status: { $in: ['pending_dept_hod', 'pending_hod', 'pending_approvals'] },
      deptHodApproved: false,
      purchaseRequisition: { $in: reqIds }
    });
  }

  return 0;
}

/** Requisitions this department head must approve (the HOD gate). */
async function countRequisitionsAwaitingHod(user: any): Promise<number> {
  const deptId = toIdString(user?.department);
  if (!deptId) return 0;

  return PurchaseRequisition.countDocuments({
    department: deptId,
    status: 'pending_hod',
    isDeleted: false
  });
}

const getActionCounts = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = req.user!;
    const role = user.role;
    // The Head of Procurement is stored as a department_head; the procurement
    // counts below have to recognise them separately.
    const procHead = isProcurementHead(user);
    const counts: Record<string, number> = {};

    // ── Approvals ──
    if (['department_head', 'finance', 'coo'].includes(role)) {
      counts['/app/approvals'] = await countPendingApprovals(user);
    }

    // ── Requisitions ──
    if (role === 'department_head') {
      // For an HOD the actionable number is what awaits their approval, not
      // every requisition their department has ever raised.
      counts['/app/requisitions'] = await countRequisitionsAwaitingHod(user);
    }

    if (role === 'procurement_officer' || procHead) {
      // Procurement acts on requisitions handed to them by stores. The Head of
      // Procurement's list also carries their own department's HOD approvals,
      // so those stay in the number.
      const accepting = await PurchaseRequisition.countDocuments({
        status: 'pending_acceptance',
        isDeleted: false
      });
      counts['/app/requisitions'] = procHead
        ? accepting + (await countRequisitionsAwaitingHod(user))
        : accepting;
    }

    // ── Stores ──
    if (role === 'stores_officer') {
      // Mirrors stores/getPendingPurchaseRequisitions.
      counts['/app/stores-pr-review'] = await PurchaseRequisition.countDocuments({
        status: 'stores_review',
        isDeleted: false
      });

      // Mirrors stores/getPendingDeliveries: orders issued but not yet fully
      // received are the ones stores still has to book in.
      counts['/app/deliveries'] = await PurchaseOrder.countDocuments({
        status: { $in: ['issued', 'partially_received'] },
        isDeleted: false
      });

      counts['/app/store-requisitions'] = await StoreRequisition.countDocuments({
        status: 'pending',
        isDeleted: false
      });
    }

    if (role === 'department_head') {
      // Mirrors department/getStoreRequisitions: only their own department's.
      counts['/app/store-requisitions'] = await StoreRequisition.countDocuments({
        ...(await buildDepartmentFilter(user)),
        status: 'pending',
        isDeleted: false
      });
    }

    // ── Sourcing ──
    if (role === 'procurement_officer' || procHead) {
      // Live RFQs: still collecting bids, or collected and awaiting an award
      // decision. Draft and awarded need no action.
      counts['/app/rfqs'] = await RFQ.countDocuments({
        status: { $in: ['open', 'evaluating'] },
        isDeleted: false
      });

      // Quotations a supplier has sent in that nobody has ruled on yet.
      counts['/app/quotations'] = await Quotation.countDocuments({
        status: { $in: ['submitted', 'under_review'] },
        isDeleted: false
      });
    }

    if (procHead) {
      // Mirrors procurement/getPendingAuthorizations, less the ones this user
      // selected themselves: they cannot authorize those, so it is not their work.
      const pending = await listPendingAuthorizations(user._id);
      counts['/app/authorizations'] = pending.filter((p) => !p.selectedByMe).length;
    }

    // ── Finance ──
    if (role === 'finance') {
      // Invoices finance still has to rule on: newly submitted, and those the
      // three-way match flagged as a variance. Approved, paid and rejected are
      // settled and need no action.
      counts['/app/invoices'] = await Invoice.countDocuments({
        status: { $in: ['submitted', 'variance'] },
        isDeleted: false
      });
    }

    res.status(200).json({ success: true, data: counts });
  } catch (error: any) {
    console.error('Get action counts error:', error);
    // The badges are an aid, not the page itself — a failure here must not
    // break the sidebar, so an empty map is returned rather than a 500.
    res.status(200).json({ success: true, data: {} });
  }
};

export default getActionCounts;
