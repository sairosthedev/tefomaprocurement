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
 *
 * The counts are independent of one another, so they are all started at once
 * and awaited together: one after another, each cost a full database round
 * trip, and this runs on every page.
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
    if (isProcurementHead(user)) {
      // Their own step, plus every order still at the removed department-head
      // step, which now comes to them.
      return PurchaseOrder.countDocuments({
        isDeleted: false,
        $or: [
          { status: 'pending_proc_hod', procHodApproved: false },
          { status: { $in: ['pending_dept_hod', 'pending_hod', 'pending_approvals'] }, deptHodApproved: false }
        ]
      });
    }

    // A requesting-department HOD only approves their own department's orders,
    // resolved through the requisitions belonging to that department.
    const deptId = toIdString(user?.department);
    if (!deptId) return 0;
    const reqIds = await PurchaseRequisition.find({ department: deptId, isDeleted: false }).distinct('_id');
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
    const procurement = role === 'procurement_officer' || procHead;
    // Each count is started as it is added and only awaited at the end.
    const pending: Record<string, Promise<number>> = {};

    // ── Approvals ──
    if (['department_head', 'finance', 'coo'].includes(role)) {
      pending['/app/approvals'] = countPendingApprovals(user);
    }

    // ── Requisitions ──
    if (procurement) {
      // Procurement acts on requisitions handed to them by stores. The Head of
      // Procurement's list also carries their own department's HOD approvals,
      // so those stay in the number.
      const accepting = PurchaseRequisition.countDocuments({
        status: 'pending_acceptance',
        isDeleted: false
      }).exec();
      pending['/app/requisitions'] = procHead
        ? Promise.all([accepting, countRequisitionsAwaitingHod(user)]).then(([a, b]) => a + b)
        : accepting;
    } else if (role === 'department_head') {
      // For an HOD the actionable number is what awaits their approval, not
      // every requisition their department has ever raised.
      pending['/app/requisitions'] = countRequisitionsAwaitingHod(user);
    }

    // ── Stores ──
    if (role === 'stores_officer') {
      // Mirrors stores/getPendingPurchaseRequisitions.
      pending['/app/stores-pr-review'] = PurchaseRequisition.countDocuments({
        status: 'stores_review',
        isDeleted: false
      }).exec();

      // Mirrors stores/getPendingDeliveries: orders issued but not yet fully
      // received are the ones stores still has to book in.
      pending['/app/deliveries'] = PurchaseOrder.countDocuments({
        status: { $in: ['issued', 'partially_received'] },
        isDeleted: false
      }).exec();

      pending['/app/store-requisitions'] = StoreRequisition.countDocuments({
        status: 'pending',
        isDeleted: false
      }).exec();
    }

    if (role === 'department_head') {
      // Mirrors department/getStoreRequisitions: only their own department's.
      pending['/app/store-requisitions'] = buildDepartmentFilter(user).then((deptFilter) =>
        StoreRequisition.countDocuments({
          ...deptFilter,
          status: 'pending',
          isDeleted: false
        }).exec()
      );
    }

    // ── Sourcing ──
    if (procurement) {
      // Live RFQs: still collecting bids, or collected and awaiting an award
      // decision. Draft and awarded need no action.
      pending['/app/rfqs'] = RFQ.countDocuments({
        status: { $in: ['open', 'evaluating'] },
        isDeleted: false
      }).exec();

      // Quotations a supplier has sent in that nobody has ruled on yet.
      pending['/app/quotations'] = Quotation.countDocuments({
        status: { $in: ['submitted', 'under_review'] },
        isDeleted: false
      }).exec();
    }

    if (procHead) {
      // Mirrors procurement/getPendingAuthorizations, less the ones this user
      // selected themselves: they cannot authorize those, so it is not their work.
      pending['/app/authorizations'] = listPendingAuthorizations(user._id).then(
        (items) => items.filter((p) => !p.selectedByMe).length
      );
    }

    // ── Finance ──
    if (role === 'finance') {
      // Invoices finance still has to rule on: newly submitted, and those the
      // three-way match flagged as a variance. Approved, paid and rejected are
      // settled and need no action.
      pending['/app/invoices'] = Invoice.countDocuments({
        status: { $in: ['submitted', 'variance'] },
        isDeleted: false
      }).exec();
    }

    const hrefs = Object.keys(pending);
    const values = await Promise.all(Object.values(pending));
    const counts: Record<string, number> = Object.fromEntries(hrefs.map((href, i) => [href, values[i]]));

    res.status(200).json({ success: true, data: counts });
  } catch (error: any) {
    console.error('Get action counts error:', error);
    // The badges are an aid, not the page itself — a failure here must not
    // break the sidebar, so an empty map is returned rather than a 500.
    res.status(200).json({ success: true, data: {} });
  }
};

export default getActionCounts;
