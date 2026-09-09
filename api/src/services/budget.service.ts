/**
 * Budget allocation, commitment and utilisation.
 *
 * One place computes these figures so the Budgets page and the checks that run
 * when a requisition is submitted can never disagree. BRD 4.11:
 *
 *   FR-B1  Finance allocates a budget per department per financial year.
 *   FR-B2  Show allocation, committed, utilised and available per department.
 *   FR-B3  Commit budget when a requisition is raised, and block or flag
 *          requests that exceed the available balance.
 *
 * Money is counted in three buckets, each at a different stage of the workflow:
 *
 *   utilised   money that has left the business - completed payments
 *   committed  money promised but not yet paid - open purchase orders, plus
 *              requisitions that are approved or in sourcing but have not
 *              reached a purchase order yet
 *   available  allocation - utilised - committed
 *
 * Requisitions are included in `committed` because a department that has raised
 * ten requests has effectively spoken for that money, even though no purchase
 * order exists yet. Leaving them out was what allowed a department to commit
 * well past its allocation before anything showed on the budget page.
 *
 * Double counting is avoided by excluding any requisition that already has a
 * purchase order against it - that spend is counted once, on the order.
 */

import mongoose from 'mongoose';
import {
  Department,
  DepartmentBudget,
  PurchaseOrder,
  Payment,
  PurchaseRequisition
} from '../models/index.js';

/** Purchase orders that represent money promised but not yet paid. */
const COMMITTED_PO_STATUSES = [
  'pending_hod',
  'pending_finance',
  'pending_coo',
  'pending_approvals',
  'approved',
  'issued',
  'acknowledged',
  'partially_delivered',
  'delivered'
];

/**
 * Requisition statuses that hold budget: the request is live and heading
 * towards a purchase, but no order exists yet. Draft is excluded - nothing has
 * been asked for. Terminal states (rejected, cancelled, fulfilled from stock,
 * completed) release their hold.
 */
const COMMITTED_PR_STATUSES = [
  'pending_hod',
  'stores_review',
  'pending_acceptance',
  'accepted',
  'sourcing',
  'quoted'
];

export interface DepartmentBudgetRow {
  departmentId: string;
  name: string;
  code?: string;
  budget: number;
  utilised: number;
  committed: number;
  available: number;
  /** Share of the allocation already spent or promised, 0-100+. */
  percentage: number;
  /** Negative when the department is over its allocation. */
  variance: number;
  isOverBudget: boolean;
}

/**
 * The window a fiscal year covers.
 *
 * Fossil's financial year is taken as the calendar year. If that changes, this
 * is the only place that needs to know.
 */
export function fiscalYearRange(fiscalYear: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(fiscalYear, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(fiscalYear + 1, 0, 1, 0, 0, 0, 0))
  };
}

function emptyTotals(departmentIds: string[]): Map<string, number> {
  const m = new Map<string, number>();
  departmentIds.forEach((id) => m.set(id, 0));
  return m;
}

function toObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  return ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
}

/** Completed payments in the fiscal year, attributed via PO to PR to department. */
async function sumUtilisedByDepartment(
  departmentIds: string[],
  fiscalYear: number
): Promise<Map<string, number>> {
  const totals = emptyTotals(departmentIds);
  if (departmentIds.length === 0) return totals;

  const { start, end } = fiscalYearRange(fiscalYear);

  const rows = await Payment.aggregate([
    {
      $match: {
        isDeleted: false,
        status: 'completed',
        // Scope to the year being reported. Without this every payment ever
        // made counts against a single year's allocation.
        paymentDate: { $gte: start, $lt: end }
      }
    },
    { $unwind: '$invoices' },
    { $lookup: { from: 'invoices', localField: 'invoices', foreignField: '_id', as: 'inv' } },
    { $unwind: '$inv' },
    { $lookup: { from: 'purchaseorders', localField: 'inv.purchaseOrder', foreignField: '_id', as: 'po' } },
    { $unwind: '$po' },
    { $lookup: { from: 'purchaserequisitions', localField: 'po.purchaseRequisition', foreignField: '_id', as: 'pr' } },
    { $unwind: '$pr' },
    { $match: { 'pr.department': { $in: toObjectIds(departmentIds) } } },
    { $group: { _id: '$pr.department', total: { $sum: '$amount' } } }
  ]);

  rows.forEach((r: { _id: unknown; total: number }) => totals.set(String(r._id), r.total || 0));
  return totals;
}

/** Open purchase orders in the fiscal year, attributed via PR to department. */
async function sumCommittedOrdersByDepartment(
  departmentIds: string[],
  fiscalYear: number
): Promise<Map<string, number>> {
  const totals = emptyTotals(departmentIds);
  if (departmentIds.length === 0) return totals;

  const { start, end } = fiscalYearRange(fiscalYear);

  const rows = await PurchaseOrder.aggregate([
    {
      $match: {
        isDeleted: false,
        status: { $in: COMMITTED_PO_STATUSES },
        purchaseRequisition: { $exists: true, $ne: null },
        createdAt: { $gte: start, $lt: end }
      }
    },
    { $lookup: { from: 'purchaserequisitions', localField: 'purchaseRequisition', foreignField: '_id', as: 'pr' } },
    { $unwind: '$pr' },
    { $match: { 'pr.department': { $in: toObjectIds(departmentIds) } } },
    { $group: { _id: '$pr.department', total: { $sum: '$totalAmount' } } }
  ]);

  rows.forEach((r: { _id: unknown; total: number }) => totals.set(String(r._id), r.total || 0));
  return totals;
}

/**
 * Live requisitions with no purchase order yet, valued at their estimated cost.
 *
 * This is the half of `committed` that closes the gap between someone raising a
 * request and an order existing. Requisitions carry estimates, not quoted
 * prices, so these figures are approximate by nature - which is the honest
 * position at that point in the workflow.
 */
async function sumCommittedRequisitionsByDepartment(
  departmentIds: string[],
  fiscalYear: number,
  excludeRequisitionId?: string
): Promise<Map<string, number>> {
  const totals = emptyTotals(departmentIds);
  if (departmentIds.length === 0) return totals;

  const { start, end } = fiscalYearRange(fiscalYear);

  const match: Record<string, unknown> = {
    isDeleted: { $ne: true },
    status: { $in: COMMITTED_PR_STATUSES },
    department: { $in: toObjectIds(departmentIds) },
    createdAt: { $gte: start, $lt: end }
  };

  if (excludeRequisitionId && mongoose.Types.ObjectId.isValid(excludeRequisitionId)) {
    match._id = { $ne: new mongoose.Types.ObjectId(excludeRequisitionId) };
  }

  const rows = await PurchaseRequisition.aggregate([
    { $match: match },
    // A requisition that already has a purchase order is counted on the order,
    // not here, so that the same spend is never held twice.
    {
      $lookup: {
        from: 'purchaseorders',
        let: { prId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$purchaseRequisition', '$$prId'] }, isDeleted: false } },
          { $limit: 1 }
        ],
        as: 'orders'
      }
    },
    { $match: { orders: { $size: 0 } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$department',
        total: {
          $sum: {
            $ifNull: [
              '$items.estimatedTotalPrice',
              {
                $multiply: [
                  { $ifNull: ['$items.estimatedUnitPrice', 0] },
                  { $ifNull: ['$items.quantity', 0] }
                ]
              }
            ]
          }
        }
      }
    }
  ]);

  rows.forEach((r: { _id: unknown; total: number }) => totals.set(String(r._id), r.total || 0));
  return totals;
}

/** The estimated value of a single requisition. */
export function requisitionEstimatedTotal(requisition: {
  items?: Array<{ estimatedTotalPrice?: number; estimatedUnitPrice?: number; quantity?: number }>;
}): number {
  return (requisition.items || []).reduce((sum, item) => {
    const line =
      item.estimatedTotalPrice ?? (item.estimatedUnitPrice || 0) * (item.quantity || 0);
    return sum + (Number.isFinite(line) ? line : 0);
  }, 0);
}

/**
 * Budget position for a set of departments.
 *
 * `excludeRequisitionId` leaves one requisition out of the committed figure, so
 * a request can be checked against the balance that would remain without it.
 */
export async function getBudgetPositions(
  departments: Array<{ _id: unknown; name: string; code?: string }>,
  fiscalYear: number,
  options: { excludeRequisitionId?: string } = {}
): Promise<DepartmentBudgetRow[]> {
  const departmentIds = departments.map((d) => String(d._id));

  const [allocations, utilised, committedOrders, committedRequests] = await Promise.all([
    DepartmentBudget.find({ fiscalYear, isDeleted: false }).lean(),
    sumUtilisedByDepartment(departmentIds, fiscalYear),
    sumCommittedOrdersByDepartment(departmentIds, fiscalYear),
    sumCommittedRequisitionsByDepartment(departmentIds, fiscalYear, options.excludeRequisitionId)
  ]);

  const allocationMap = new Map(allocations.map((a) => [String(a.department), a.allocatedAmount]));

  return departments.map((dept) => {
    const id = String(dept._id);
    const budget = allocationMap.get(id) || 0;
    const used = utilised.get(id) || 0;
    const committed = (committedOrders.get(id) || 0) + (committedRequests.get(id) || 0);

    // Not floored at zero: a department that has overspent must show it, rather
    // than looking identical to one sitting exactly on its allocation.
    const available = budget - used - committed;

    // Includes committed spend. Reporting only `utilised / budget` showed a
    // department with its whole allocation tied up in open orders as 0% used.
    const percentage = budget > 0 ? Math.round(((used + committed) / budget) * 100) : 0;

    return {
      departmentId: id,
      name: dept.name,
      code: dept.code,
      budget,
      utilised: used,
      committed,
      available,
      percentage,
      variance: available,
      isOverBudget: budget > 0 && available < 0
    };
  });
}

export interface BudgetCheck {
  /** False when no allocation exists, so nothing can be judged. */
  hasAllocation: boolean;
  fiscalYear: number;
  departmentName: string;
  budget: number;
  availableBefore: number;
  requestAmount: number;
  availableAfter: number;
  /** The request takes the department past its allocation. */
  exceedsBudget: boolean;
  /**
   * True when the request carries no estimated value. The check cannot mean
   * anything in that case, and callers must not read a pass as approval.
   */
  unpriced: boolean;
  message: string;
}

/**
 * Check one requisition against its department's remaining balance.
 *
 * Reports rather than decides: it never throws and never rejects. The caller
 * chooses what to do, which keeps the policy question - flag or block - in the
 * workflow where it belongs.
 */
export async function checkRequisitionAgainstBudget(requisition: {
  _id?: unknown;
  department?: unknown;
  items?: Array<{ estimatedTotalPrice?: number; estimatedUnitPrice?: number; quantity?: number }>;
  createdAt?: Date;
}): Promise<BudgetCheck | null> {
  if (!requisition.department) return null;

  const departmentId = String(
    (requisition.department as { _id?: unknown })?._id ?? requisition.department
  );
  if (!mongoose.Types.ObjectId.isValid(departmentId)) return null;

  const dept = await Department.findById(departmentId).select('name code').lean();
  if (!dept) return null;

  const deptName = (dept as unknown as { name: string }).name;
  const deptCode = (dept as unknown as { code?: string }).code;

  const fiscalYear = (requisition.createdAt ? new Date(requisition.createdAt) : new Date()).getFullYear();
  const requestAmount = requisitionEstimatedTotal(requisition);

  const [position] = await getBudgetPositions(
    [{ _id: departmentId, name: deptName, code: deptCode }],
    fiscalYear,
    // Exclude this requisition so its own value is not counted twice: once in
    // the committed total and again as the amount being requested.
    { excludeRequisitionId: requisition._id ? String(requisition._id) : undefined }
  );

  const availableBefore = position.available;
  const availableAfter = availableBefore - requestAmount;
  const hasAllocation = position.budget > 0;
  const unpriced = requestAmount <= 0;
  const exceedsBudget = hasAllocation && !unpriced && availableAfter < 0;

  let message: string;
  if (!hasAllocation) {
    message = `No budget has been allocated to ${deptName} for ${fiscalYear}, so this request cannot be checked against one.`;
  } else if (unpriced) {
    message = `This requisition has no estimated cost, so it cannot be checked against the ${deptName} budget.`;
  } else if (exceedsBudget) {
    message =
      `This request of ${requestAmount.toFixed(2)} exceeds the remaining ${deptName} budget ` +
      `for ${fiscalYear}. Available before this request: ${availableBefore.toFixed(2)}. ` +
      `Approving it would put the department ${Math.abs(availableAfter).toFixed(2)} over its allocation.`;
  } else {
    message =
      `Within budget. ${deptName} has ${availableBefore.toFixed(2)} available for ${fiscalYear}; ` +
      `${availableAfter.toFixed(2)} would remain after this request.`;
  }

  return {
    hasAllocation,
    fiscalYear,
    departmentName: deptName,
    budget: position.budget,
    availableBefore,
    requestAmount,
    availableAfter,
    exceedsBudget,
    unpriced,
    message
  };
}
