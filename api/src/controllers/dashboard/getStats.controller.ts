import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { isProcurementHead, formatCurrency } from '@fossil/shared';
import { User, SupplierProfile, RFQ, Quotation, PurchaseOrder, Inventory, PurchaseRequisition, AuditLog, Department, Site, Delivery } from '../../models/index.js';
import { buildRoleReportCharts } from '../../lib/reportAnalytics.js';
import { resolveUserDepartmentIds } from '../../lib/departmentScope.js';
import { currentBaseCurrency } from '../../tenancy/sbuContext.js';

/** How long a requester's rejected requisition stays under "Needs attention". */
const RECENT_REJECTION_DAYS = 14;

/*
 * Every number on the dashboard is an independent query, and each one costs a
 * full database round trip. Awaited one after another they made this the
 * slowest page in the app, so each role's queries are started together and
 * awaited as one batch. A query the role does not show is never run, and a
 * number shown twice (a stat and its attention item) is fetched once.
 */

// Every status a PO can wait at on its way through approval. The legacy
// single-queue statuses stay in so older orders are still counted.
const PO_PENDING_STATUSES = [
  'pending_dept_hod',
  'pending_proc_hod',
  'pending_hod',
  'pending_finance',
  'pending_coo',
  'pending_approvals'
];
const PO_APPROVED_STATUSES = ['approved', 'issued', 'partially_received', 'completed'];
// Finance's queue, as finance/getPendingApprovals lists it.
const FINANCE_QUEUE_FILTER = {
  status: { $in: ['pending_finance', 'pending_approvals'] },
  hodApproved: true,
  financeApproved: false,
  isDeleted: false
};
const FINANCE_APPROVED_FILTER = {
  status: { $in: ['pending_coo', ...PO_APPROVED_STATUSES] },
  financeApproved: true,
  isDeleted: false
};
// The COO's queue, as coo/getPendingApprovals lists it.
const COO_QUEUE_FILTER = {
  status: { $in: ['pending_coo', 'pending_approvals'] },
  requiresCooApproval: true,
  hodApproved: true,
  financeApproved: true,
  cooApproved: false,
  isDeleted: false
};
const LOW_STOCK_FILTER = { quantityOnHand: { $lte: 5 }, isDeleted: false };
// No longer a simple filter — see count.pendingDeliveries below.
const PR_IN_PROGRESS_STATUSES = ['stores_review', 'pending_acceptance', 'accepted', 'sourcing', 'quoted', 'ordered'];

type Severity = 'high' | 'medium' | 'low';
interface AttentionItem {
  id: string;
  label: string;
  count: number;
  href: string;
  severity: Severity;
}
interface RoleStats {
  stats: Record<string, unknown>;
  additionalStats: Record<string, unknown>;
  attentionItems: AttentionItem[];
}

const oneMonthAgo = () => new Date(new Date().setMonth(new Date().getMonth() - 1));
const money = (amount: number) => formatCurrency(amount, currentBaseCurrency());
const needsAttention = (items: AttentionItem[]) => items.filter((item) => item.count > 0);

/** Sum one numeric field over the documents matching `match`. */
async function sumOf(model: any, match: Record<string, unknown>, field: string): Promise<number> {
  const [row] = await model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$${field}` } } }
  ]);
  return row?.total || 0;
}

/**
 * Requisition counts per status in one pass, for roles that show several
 * status counts over the same set of requisitions. `of()` adds up the statuses
 * given; `total` counts every requisition the match takes in.
 */
async function requisitionStatusCounts(match: Record<string, unknown>) {
  const rows: Array<{ _id: string | null; n: number }> = await PurchaseRequisition.aggregate([
    { $match: match },
    { $group: { _id: '$status', n: { $sum: 1 } } }
  ]);
  const byStatus = new Map(rows.map((row) => [row._id, row.n]));
  return {
    total: rows.reduce((sum, row) => sum + row.n, 0),
    of: (...statuses: string[]) => statuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0)
  };
}

/**
 * The requisitions a department head's dashboard covers: their department's,
 * or their own when they have no department. Ids are cast here because an
 * aggregation, unlike a find, does not cast them itself — and `protect`
 * populates `department`, so it arrives as a document rather than an id.
 */
function deptRequisitionMatch(user: Request['user']): Record<string, unknown> {
  const match: Record<string, unknown> = { isDeleted: false };
  const department = user?.department as { _id?: unknown } | undefined;
  if (department) {
    match.department = new mongoose.Types.ObjectId(String(department._id ?? department));
  } else if (user?._id) {
    match.requestedBy = new mongoose.Types.ObjectId(String(user._id));
  }
  return match;
}

/**
 * Orders still at the removed department-head PO step for this head's
 * departments. Dept HOD PO approval was removed and only Procurement HOD has a
 * PO queue now; this keeps any legacy pending_dept_hod records counted.
 * resolveUserDepartmentIds honours Department.head as well as User.department.
 *
 * The waiting orders are fetched alongside the departments rather than after
 * them, and only their own requisitions are checked against the departments —
 * not every requisition the departments ever raised. With no legacy orders
 * left, which is the usual case, that check is skipped altogether.
 */
async function countDeptPendingPoApprovals(user: Request['user']): Promise<number> {
  const [deptIds, waitingOrders] = await Promise.all([
    resolveUserDepartmentIds(user),
    PurchaseOrder.find({
      isDeleted: false,
      status: { $in: ['pending_dept_hod', 'pending_hod', 'pending_approvals'] },
      deptHodApproved: false,
      purchaseRequisition: { $ne: null }
    })
      .select('purchaseRequisition')
      .lean()
  ]);
  if (!deptIds.length || !waitingOrders.length) return 0;

  const deptReqIds = await PurchaseRequisition.find({
    _id: { $in: waitingOrders.map((po: any) => po.purchaseRequisition) },
    department: { $in: deptIds },
    isDeleted: false
  }).distinct('_id');
  const inDept = new Set(deptReqIds.map(String));
  return waitingOrders.filter((po: any) => inDept.has(String(po.purchaseRequisition))).length;
}

/** The ten latest audit entries. The audit log is system-wide, so admin only. */
async function loadRecentActivity() {
  const auditLogs = await AuditLog.find()
    .select('action description user createdAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('user', 'firstName lastName')
    .lean();

  return auditLogs.map((log: any) => ({
    id: log._id,
    type: log.action,
    message: log.description,
    user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
    time: getTimeAgo(log.createdAt)
  }));
}

// Counts more than one role shows. Each call starts a fresh query.
const count = {
  activeSuppliers: () => SupplierProfile.countDocuments({ status: 'active', isDeleted: false }),
  totalRFQs: () => RFQ.countDocuments({ isDeleted: false }),
  openRFQs: () => RFQ.countDocuments({ status: { $in: ['draft', 'open'] }, isDeleted: false }),
  totalQuotations: () => Quotation.countDocuments({ isDeleted: false }),
  pendingQuotations: () => Quotation.countDocuments({ status: 'submitted', isDeleted: false }),
  totalPOs: () => PurchaseOrder.countDocuments({ isDeleted: false }),
  pendingPOs: () => PurchaseOrder.countDocuments({ status: { $in: PO_PENDING_STATUSES }, isDeleted: false }),
  approvedPOs: () => PurchaseOrder.countDocuments({ status: { $in: PO_APPROVED_STATUSES }, isDeleted: false }),
  lowStock: () => Inventory.countDocuments(LOW_STOCK_FILTER),
  // Mirrors getPendingDeliveries: POs with a pending delivery record +
  // issued POs with no delivery at all. partially_received POs with no
  // pending delivery are waiting for the supplier — stores can't action them.
  pendingDeliveries: async () => {
    const openPOs = await PurchaseOrder.find(
      { status: { $in: ['issued', 'partially_received'] }, isDeleted: false },
      '_id status'
    ).lean();
    if (!openPOs.length) return 0;
    const poIds = openPOs.map((po: any) => po._id);
    const pendingDels = await Delivery.find(
      { purchaseOrder: { $in: poIds }, status: 'pending', isDeleted: false },
      'purchaseOrder'
    ).lean();
    const withPending = new Set(pendingDels.map((d: any) => d.purchaseOrder.toString()));
    return openPOs.filter(
      (po: any) => withPending.has(po._id.toString()) || po.status === 'issued'
    ).length;
  },
  approvedPOValueSince: (since?: Date) =>
    sumOf(PurchaseOrder, {
      status: { $in: PO_APPROVED_STATUSES },
      isDeleted: false,
      ...(since ? { createdAt: { $gte: since } } : {})
    }, 'totalAmount')
};

/** The four system-wide cards shown to a role with nothing of its own. */
async function genericStats(): Promise<Record<string, unknown>> {
  const [openRFQs, totalQuotations, totalPOs, activeSuppliers] = await Promise.all([
    count.openRFQs(),
    count.totalQuotations(),
    count.totalPOs(),
    count.activeSuppliers()
  ]);
  return {
    openRFQs: { value: openRFQs, label: 'Open RFQs' },
    quotations: { value: totalQuotations, label: 'Quotations' },
    purchaseOrders: { value: totalPOs, label: 'Purchase Orders' },
    suppliers: { value: activeSuppliers, label: 'Active Suppliers' }
  };
}

/** A supplier's own RFQs, quotations and orders. */
async function supplierCounts(supplierId: unknown) {
  const [myQuotations, myPOs, myRFQs, submittedQuotations] = await Promise.all([
    Quotation.countDocuments({ supplier: supplierId, isDeleted: false }),
    PurchaseOrder.countDocuments({ supplier: supplierId, isDeleted: false }),
    RFQ.countDocuments({
      invitedSuppliers: { $elemMatch: { supplier: supplierId } },
      status: { $in: ['draft', 'open'] },
      isDeleted: false
    }),
    Quotation.countDocuments({ supplier: supplierId, status: 'submitted', isDeleted: false })
  ]);
  return { myQuotations, myPOs, myRFQs, submittedQuotations };
}

async function buildRoleStats(
  userRole: string,
  user: NonNullable<Request['user']>,
  supplierProfile: () => Promise<{ _id: unknown } | null>
): Promise<RoleStats> {
  switch (userRole) {
    case 'admin': {
      const [
        openRFQs,
        pendingQuotations,
        pendingPOs,
        activeSuppliers,
        totalPOs,
        totalUsers,
        activeUsers,
        pendingSuppliers,
        kysIncomplete,
        pendingRequisitions,
        evaluationsDue,
        monthlyPOValue,
        lowStockItems,
        totalDepartments,
        totalSites,
        failedLogins
      ] = await Promise.all([
        count.openRFQs(),
        count.pendingQuotations(),
        count.pendingPOs(),
        count.activeSuppliers(),
        count.totalPOs(),
        User.countDocuments({ isDeleted: false }),
        User.countDocuments({ isDeleted: false, status: 'active' }),
        SupplierProfile.countDocuments({ status: 'pending', isDeleted: false }),
        SupplierProfile.countDocuments({
          status: 'active',
          kysComplete: false,
          kysExempt: { $ne: true },
          isDeleted: false
        }),
        PurchaseRequisition.countDocuments({
          status: { $in: ['pending_hod', 'stores_review', 'pending_acceptance', 'sourcing'] },
          isDeleted: false
        }),
        SupplierProfile.countDocuments({
          status: 'active',
          isDeleted: false,
          nextEvaluationDue: { $lte: new Date() }
        }),
        count.approvedPOValueSince(oneMonthAgo()),
        count.lowStock(),
        Department.countDocuments({ isDeleted: false }),
        Site.countDocuments({ isDeleted: false }),
        AuditLog.countDocuments({
          action: 'login_failed',
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      ]);

      return {
        stats: {
          totalUsers: { value: totalUsers, label: 'Total Users', href: '/app/users' },
          activeUsers: { value: activeUsers, label: 'Active Users', href: '/app/users' },
          pendingSuppliers: { value: pendingSuppliers, label: 'Suppliers Pending Review', href: '/app/suppliers' },
          openRFQs: { value: openRFQs, label: 'Open RFQs' },
          pendingQuotations: { value: pendingQuotations, label: 'Quotations to Review' },
          pendingPOApprovals: { value: pendingPOs, label: 'POs Pending Approval', href: '/app/purchase-orders' }
        },
        additionalStats: {
          activeSuppliers: { value: activeSuppliers, label: 'Active Suppliers', href: '/app/suppliers' },
          totalPOs: { value: totalPOs, label: 'All Purchase Orders', href: '/app/purchase-orders' },
          pendingRequisitions: { value: pendingRequisitions, label: 'Requisitions In Progress' },
          monthlyPOValue: { value: money(monthlyPOValue), label: 'PO Value (30 days)' },
          kysIncomplete: { value: kysIncomplete, label: 'KYS Incomplete', href: '/app/suppliers/analytics/compliance' },
          evaluationsDue: { value: evaluationsDue, label: 'Evaluations Due', href: '/app/suppliers/evaluations' },
          lowStock: { value: lowStockItems, label: 'Low Stock Items', href: '/app/reports' },
          departments: { value: totalDepartments, label: 'Departments', href: '/app/departments' },
          sites: { value: totalSites, label: 'Sites', href: '/app/sites' },
          failedLogins: { value: failedLogins, label: 'Failed Logins (7d)', href: '/app/audit-logs' }
        },
        // Approvals and quotation reviews are not the admin's to act on, so they
        // are reported in the stats above rather than raised as attention items.
        attentionItems: needsAttention([
          { id: 'pending-suppliers', label: 'Suppliers awaiting activation', count: pendingSuppliers, href: '/app/suppliers', severity: 'high' },
          { id: 'kys-incomplete', label: 'Active suppliers with incomplete KYS', count: kysIncomplete, href: '/app/suppliers/analytics/compliance', severity: 'medium' },
          { id: 'evaluations-due', label: 'Supplier evaluations overdue', count: evaluationsDue, href: '/app/suppliers/evaluations', severity: 'medium' },
          { id: 'low-stock', label: 'Inventory items below reorder level', count: lowStockItems, href: '/app/reports', severity: 'low' },
          { id: 'failed-logins', label: 'Failed login attempts (7 days)', count: failedLogins, href: '/app/audit-logs', severity: failedLogins >= 5 ? 'high' : 'low' }
        ])
      };
    }

    case 'procurement_officer': {
      const noPO = { $or: [{ purchaseOrder: { $exists: false } }, { purchaseOrder: null }] };
      const [
        openRFQs,
        pendingQuotations,
        activeSuppliers,
        totalPOs,
        totalQuotations,
        totalRFQs,
        approvedQuotations,
        pendingAcceptance,
        acceptedRequisitions,
        sourcingRequisitions,
        orderedRequisitions
      ] = await Promise.all([
        count.openRFQs(),
        count.pendingQuotations(),
        count.activeSuppliers(),
        count.totalPOs(),
        count.totalQuotations(),
        count.totalRFQs(),
        Quotation.countDocuments({ status: 'accepted', isDeleted: false }),
        PurchaseRequisition.countDocuments({ status: 'pending_acceptance', isDeleted: false }),
        PurchaseRequisition.countDocuments({ status: 'accepted', ...noPO, isDeleted: false }),
        PurchaseRequisition.countDocuments({ status: 'sourcing', ...noPO, isDeleted: false }),
        PurchaseRequisition.countDocuments({
          $or: [{ purchaseOrder: { $exists: true, $ne: null } }, { status: 'ordered' }],
          isDeleted: false
        })
      ]);

      return {
        stats: {
          openRFQs: { value: openRFQs, label: 'Open RFQs' },
          pendingQuotations: { value: pendingQuotations, label: 'Pending Quotations' },
          activeSuppliers: { value: activeSuppliers, label: 'Active Suppliers' },
          purchaseOrders: { value: totalPOs, label: 'Purchase Orders' }
        },
        additionalStats: {
          totalQuotations: { value: totalQuotations, label: 'Total Quotations' },
          approvedQuotations: { value: approvedQuotations, label: 'Approved Quotations' },
          totalRFQs: { value: totalRFQs, label: 'Total RFQs' },
          pendingAcceptance: { value: pendingAcceptance, label: 'Awaiting Acceptance' },
          acceptedRequisitions: { value: acceptedRequisitions, label: 'Accepted' },
          sourcingRequisitions: { value: sourcingRequisitions, label: 'In Sourcing' },
          orderedRequisitions: { value: orderedRequisitions, label: 'Ordered' }
        },
        attentionItems: needsAttention([
          { id: 'pending-acceptance', label: 'Requisitions awaiting acceptance', count: pendingAcceptance, href: '/app/requisitions', severity: 'high' },
          { id: 'pending-quotations', label: 'Quotations awaiting evaluation', count: pendingQuotations, href: '/app/quotations', severity: 'medium' },
          { id: 'open-rfqs', label: 'Open RFQs collecting quotations', count: openRFQs, href: '/app/rfqs', severity: 'low' }
        ])
      };
    }

    case 'finance': {
      // pendingApproval mirrors finance/getPendingApprovals, the queue it stands for.
      const [pendingApproval, financeApproved, totalPOValue, totalPOs, pendingValue, monthlyValue] = await Promise.all([
        PurchaseOrder.countDocuments(FINANCE_QUEUE_FILTER),
        PurchaseOrder.countDocuments(FINANCE_APPROVED_FILTER),
        count.approvedPOValueSince(),
        count.totalPOs(),
        sumOf(PurchaseOrder, FINANCE_QUEUE_FILTER, 'totalAmount'),
        count.approvedPOValueSince(oneMonthAgo())
      ]);

      return {
        stats: {
          pendingApproval: { value: pendingApproval, label: 'Pending Approval' },
          approved: { value: financeApproved, label: 'Approved POs' },
          totalValue: { value: money(totalPOValue), label: 'Total PO Value' },
          totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
        },
        additionalStats: {
          pendingValue: { value: money(pendingValue), label: 'Pending Value' },
          monthlyValue: { value: money(monthlyValue), label: 'Monthly PO Value' },
          approvedPOs: { value: financeApproved, label: 'Finance Approved' },
          totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
        },
        attentionItems: needsAttention([
          { id: 'pending-finance', label: 'Purchase orders awaiting finance approval', count: pendingApproval, href: '/app/approvals', severity: 'high' }
        ])
      };
    }

    case 'coo': {
      const [pendingApproval, cooApproved, pendingCooStatusValue, totalPOs, queueValue, majorPOs] = await Promise.all([
        PurchaseOrder.countDocuments(COO_QUEUE_FILTER),
        PurchaseOrder.countDocuments({ cooApproved: true, isDeleted: false }),
        sumOf(PurchaseOrder, { status: 'pending_coo', isDeleted: false }, 'totalAmount'),
        count.totalPOs(),
        sumOf(PurchaseOrder, COO_QUEUE_FILTER, 'totalAmount'),
        PurchaseOrder.countDocuments({
          status: 'pending_coo',
          $or: [
            { totalAmountUsd: { $gte: 50000 } },
            { totalAmountUsd: { $exists: false }, totalAmount: { $gte: 50000 } }
          ],
          isDeleted: false
        })
      ]);

      return {
        stats: {
          pendingApproval: { value: pendingApproval, label: 'Pending Approval' },
          approved: { value: cooApproved, label: 'Approved by COO' },
          pendingValue: { value: money(pendingCooStatusValue), label: 'Pending Value' },
          totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
        },
        additionalStats: {
          pendingValue: { value: money(queueValue), label: 'Pending Value' },
          majorPOs: { value: majorPOs, label: 'Major POs Pending' },
          cooApproved: { value: cooApproved, label: 'COO Approved' },
          totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
        },
        attentionItems: needsAttention([
          { id: 'pending-coo', label: 'Purchase orders awaiting your authorization', count: pendingApproval, href: '/app/approvals', severity: 'high' },
          { id: 'major-pos', label: 'Major POs (≥ USD 50k) pending', count: majorPOs, href: '/app/approvals', severity: 'high' }
        ])
      };
    }

    case 'stores_officer': {
      const [lowStockItems, totalItems, pendingDeliveries, approvedPOs, storesReviewQueue, inventoryValue, receivedThisMonth] =
        await Promise.all([
          count.lowStock(),
          Inventory.countDocuments({ isDeleted: false }),
          count.pendingDeliveries(),
          count.approvedPOs(),
          PurchaseRequisition.countDocuments({ status: 'stores_review', isDeleted: false }),
          sumOf(Inventory, { isDeleted: false }, 'totalValue'),
          PurchaseOrder.countDocuments({ status: 'completed', isDeleted: false, updatedAt: { $gte: oneMonthAgo() } })
        ]);

      return {
        stats: {
          totalItems: { value: totalItems, label: 'Inventory Items' },
          lowStock: { value: lowStockItems, label: 'Low Stock Items' },
          pendingDeliveries: { value: pendingDeliveries, label: 'Pending Deliveries' },
          purchaseOrders: { value: approvedPOs, label: 'Approved POs' }
        },
        additionalStats: {
          inventoryValue: { value: money(inventoryValue), label: 'Inventory Value' },
          itemsNeedingReorder: { value: lowStockItems, label: 'Items Needing Reorder' },
          receivedThisMonth: { value: receivedThisMonth, label: 'Received This Month' },
          pendingDeliveries: { value: pendingDeliveries, label: 'Pending Deliveries' }
        },
        attentionItems: needsAttention([
          { id: 'stores-queue', label: 'Purchase requisitions to review', count: storesReviewQueue, href: '/app/stores-pr-review', severity: 'high' },
          { id: 'low-stock', label: 'Inventory items below reorder level', count: lowStockItems, href: '/app/inventory', severity: 'medium' },
          { id: 'pending-deliveries', label: 'Deliveries pending receipt', count: pendingDeliveries, href: '/app/deliveries', severity: 'low' }
        ])
      };
    }

    case 'department_head': {
      const [reqs, pendingPoApprovals, pendingHodApproval] = await Promise.all([
        requisitionStatusCounts(deptRequisitionMatch(user)),
        countDeptPendingPoApprovals(user),
        // A head cannot approve their own requisitions, so those are not theirs to act on.
        PurchaseRequisition.countDocuments({
          ...deptRequisitionMatch(user),
          status: 'pending_hod',
          requestedBy: { $ne: new mongoose.Types.ObjectId(String(user._id)) }
        })
      ]);
      const rejectedRequisitions = reqs.of('rejected');

      return {
        stats: {
          departmentRequisitions: { value: reqs.total, label: 'Dept. Requisitions' },
          pendingApproval: { value: pendingHodApproval, label: 'Awaiting My Approval' },
          approvedRequisitions: {
            value: reqs.of('stores_review', 'fulfilled', 'pending_acceptance', 'accepted', 'sourcing', 'quoted', 'ordered', 'completed'),
            label: 'Approved'
          },
          pendingPoApprovals: { value: pendingPoApprovals, label: 'POs Pending Approval' }
        },
        additionalStats: {
          rejectedRequisitions: { value: rejectedRequisitions, label: 'Rejected' },
          inProgressRequisitions: { value: reqs.of(...PR_IN_PROGRESS_STATUSES), label: 'In Progress' },
          draftRequisitions: { value: reqs.of('draft'), label: 'Drafts' },
          pendingApproval: { value: pendingHodApproval, label: 'Awaiting My Approval' }
        },
        attentionItems: needsAttention([
          { id: 'pending-hod', label: 'Requisitions awaiting your approval', count: pendingHodApproval, href: '/app/requisitions?view=team&status=pending_hod', severity: 'high' },
          { id: 'pending-po-hod', label: 'Purchase orders awaiting your approval', count: pendingPoApprovals, href: '/app/approvals', severity: 'medium' },
          { id: 'rejected-reqs', label: 'Rejected requisitions in your department', count: rejectedRequisitions, href: '/app/requisitions?view=team&status=rejected', severity: 'medium' }
        ])
      };
    }

    case 'end_user': {
      const requestedBy = new mongoose.Types.ObjectId(String(user._id));
      const [reqs, openRFQs, recentlyRejected] = await Promise.all([
        requisitionStatusCounts({ requestedBy, isDeleted: false }),
        count.openRFQs(),
        // A rejection is news for a while, not a task forever: it cannot be
        // resubmitted, only read and, if still needed, raised again.
        PurchaseRequisition.countDocuments({
          requestedBy,
          status: 'rejected',
          isDeleted: false,
          updatedAt: { $gte: new Date(Date.now() - RECENT_REJECTION_DAYS * 24 * 60 * 60 * 1000) }
        })
      ]);
      const drafts = reqs.of('draft');
      const pendingHod = reqs.of('pending_hod');
      const rejected = reqs.of('rejected');

      return {
        stats: {
          myRequisitions: { value: reqs.total, label: 'My Requisitions' },
          drafts: { value: drafts, label: 'Drafts' },
          pendingApproval: { value: pendingHod, label: 'Awaiting HOD Approval' },
          fulfilled: { value: reqs.of('fulfilled', 'completed', 'ordered'), label: 'Fulfilled' }
        },
        additionalStats: {
          rejectedRequisitions: { value: rejected, label: 'Rejected' },
          inProgressRequisitions: { value: reqs.of(...PR_IN_PROGRESS_STATUSES), label: 'In Progress' },
          completedRequisitions: { value: reqs.of('fulfilled', 'completed'), label: 'Completed' },
          openRFQs: { value: openRFQs, label: 'Active RFQs' }
        },
        // Only what the requester has to do something about. Requisitions
        // waiting on the department head are on the stat card above.
        attentionItems: needsAttention([
          { id: 'drafts-mine', label: 'Drafts not yet submitted', count: drafts, href: '/app/requisitions?status=draft', severity: 'medium' },
          { id: 'rejected-mine', label: `Rejected in the last ${RECENT_REJECTION_DAYS} days — see why`, count: recentlyRejected, href: '/app/requisitions?status=rejected', severity: 'medium' }
        ])
      };
    }

    default: {
      // Suppliers, and any role without a dashboard of its own. Only a supplier
      // with a profile gets their own numbers on the main cards; anyone else
      // gets the system-wide ones.
      const profile = await supplierProfile();
      if (!profile) {
        const generic = await genericStats();
        return { stats: generic, additionalStats: generic, attentionItems: [] };
      }

      const [mine, generic] = await Promise.all([
        supplierCounts(profile._id),
        userRole === 'supplier' ? null : genericStats()
      ]);
      return {
        stats: generic ?? {
          myRFQs: { value: mine.myRFQs, label: 'My RFQs' },
          myQuotations: { value: mine.myQuotations, label: 'My Quotations' },
          submittedQuotations: { value: mine.submittedQuotations, label: 'Submitted Quotations' },
          myPOs: { value: mine.myPOs, label: 'My Purchase Orders' }
        },
        additionalStats: {
          myQuotations: { value: mine.myQuotations, label: 'My Quotations' },
          submittedQuotations: { value: mine.submittedQuotations, label: 'Submitted Quotations' },
          myPOs: { value: mine.myPOs, label: 'My Purchase Orders' },
          myRFQs: { value: mine.myRFQs, label: 'My RFQs' }
        },
        attentionItems: needsAttention([
          { id: 'open-rfqs-supplier', label: 'Open RFQs awaiting your quotation', count: mine.myRFQs, href: '/app/my-rfqs', severity: 'high' }
        ])
      };
    }
  }
}

const getStats = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = req.user!;
    // The head of the Procurement department operates as a procurement officer
    // for dashboard purposes.
    const userRole = isProcurementHead(user) ? 'procurement_officer' : user.role;
    const range = req.query.range as string | undefined;

    // Looked up at most once, and shared by the cards and the report charts.
    let profileLookup: Promise<{ _id: unknown } | null> | undefined;
    const supplierProfile = () =>
      (profileLookup ??= SupplierProfile.findOne({ user: user._id, isDeleted: false }).select('_id').lean().exec());

    const loadCharts = async () => {
      if (!range) return undefined;
      const profile = userRole === 'supplier' ? await supplierProfile() : null;
      // `protect` populates department, so req.user.department is the whole
      // document, not an id. Calling toString() on it yields the document's
      // text form, which is not a valid ObjectId — and the only role whose
      // charts filter by department is a non-procurement department head, so
      // this failed for exactly one role and nobody else.
      const department = user.department as { _id?: unknown } | undefined;
      return buildRoleReportCharts(userRole, range, {
        departmentId: department?._id ? String(department._id) : undefined,
        userId: user._id?.toString(),
        supplierProfileId: profile?._id?.toString()
      });
    };

    const [{ stats, additionalStats, attentionItems }, recentActivity, chartData] = await Promise.all([
      buildRoleStats(userRole, user, supplierProfile),
      // The audit log is system-wide, so only admins get it. Every other role,
      // suppliers included, would otherwise receive other people's actions.
      user.role === 'admin' ? loadRecentActivity() : [],
      loadCharts()
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats,
        recentActivity,
        additionalStats,
        attentionItems,
        ...(chartData ? { chartData } : {})
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard stats'
    });
  }
};

function getTimeAgo(date: any): string {
  const seconds = Math.floor(((new Date() as any) - (new Date(date) as any)) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(date).toLocaleDateString('en-ZA');
}

export default getStats;
