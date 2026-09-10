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
      isDeleted: false
    });
  }

  if (role === 'coo') {
    return PurchaseOrder.countDocuments({
      status: { $in: ['pending_coo', 'pending_approvals'] },
      isDeleted: false
    });
  }

  if (role === 'admin') {
    // The Approvals page sends admins to the finance queue, so the badge must
    // count that same queue rather than every pending PO.
    return PurchaseOrder.countDocuments({
      status: { $in: ['pending_finance', 'pending_approvals'] },
      isDeleted: false
    });
  }

  if (role === 'department_head') {
    if (isProcurementHead(user)) {
      return PurchaseOrder.countDocuments({
        isDeleted: false,
        status: 'pending_proc_hod',
        procHodApproved: false
      });
    }

    // A requesting-department HOD only approves their own department's orders,
    // resolved through the requisitions belonging to that department.
    const deptId = toIdString(user?.department);
    if (!deptId) return 0;

    const reqs = await PurchaseRequisition.find({ department: deptId, isDeleted: false }).select('_id');
    return PurchaseOrder.countDocuments({
      isDeleted: false,
      status: { $in: ['pending_dept_hod', 'pending_hod', 'pending_approvals'] },
      deptHodApproved: false,
      purchaseRequisition: { $in: reqs.map((r) => r._id) }
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
    const counts: Record<string, number> = {};

    // ── Approvals ──
    if (['department_head', 'finance', 'coo', 'admin'].includes(role)) {
      counts['/app/approvals'] = await countPendingApprovals(user);
    }

    // ── Requisitions ──
    if (role === 'department_head') {
      // For an HOD the actionable number is what awaits their approval, not
      // every requisition their department has ever raised.
      counts['/app/requisitions'] = await countRequisitionsAwaitingHod(user);
    }

    if (['procurement_officer', 'procurement_head', 'admin'].includes(role)) {
      // Procurement acts on requisitions handed to them by stores.
      counts['/app/requisitions'] = await PurchaseRequisition.countDocuments({
        status: 'pending_acceptance',
        isDeleted: false
      });
    }

    // ── Stores ──
    if (['stores_officer', 'admin'].includes(role)) {
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
      counts['/app/store-requisitions'] = await StoreRequisition.countDocuments({
        status: 'pending',
        isDeleted: false
      });
    }

    // ── Sourcing ──
    if (['procurement_officer', 'procurement_head', 'admin'].includes(role)) {
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

    // ── Finance ──
    if (['finance', 'admin'].includes(role)) {
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
