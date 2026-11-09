import type { Request } from 'express';
import { PurchaseRequisition } from '../models/index.js';
import { createAuditLog } from '../middleware/index.js';
import { createNotification, notifyUsersByRole, notifyUsersByDepartment } from './notification.service.js';
import { enrichRequisitionItemsWithAvailability } from './inventoryAvailability.service.js';
import { canFullyFulfillFromStock, processRequisitionAgainstStock } from './storesRequisitionProcess.service.js';
import { checkRequisitionAgainstBudget } from './budget.service.js';
import { canActOnDepartment } from '../lib/departmentScope.js';

type BudgetCheck = Awaited<ReturnType<typeof checkRequisitionAgainstBudget>> | null;

/**
 * The department's budget position for this request. A failure to compute it
 * must never stop work, so it is logged and treated as unknown.
 */
export async function budgetPositionOf(requisition: any, when: string): Promise<BudgetCheck> {
  try {
    return await checkRequisitionAgainstBudget(requisition);
  } catch (error) {
    console.error(`Budget check failed on ${when}:`, error);
    return null;
  }
}

/** Whether this user is the department head (or deputy) for the requisition's department. */
export async function headsRequisitionDepartment(user: any, requisition: any): Promise<boolean> {
  return user?.role === 'department_head' && (await canActOnDepartment(user, requisition.department));
}

export interface HodApprovalResult {
  requisition: any;
  autoProcessed: boolean;
}

/**
 * The department-head approval: the requisition goes to stores, or straight
 * out of stock when every line is held at the site.
 *
 * `overrideReason` is recorded when the request is over budget; the caller
 * decides whether one is needed and where it comes from. `ownRequisition`
 * marks a head approving what they raised themselves, so they are not sent a
 * notification about their own action.
 */
export async function approveAsDepartmentHead(
  requisition: any,
  req: Request,
  options: { comments?: string; budgetCheck: BudgetCheck; overrideReason?: string; ownRequisition?: boolean }
): Promise<HodApprovalResult> {
  const user = req.user!;
  const { budgetCheck, overrideReason = '', ownRequisition = false } = options;
  const needsOverride = budgetCheck?.exceedsBudget === true;
  const comments = options.comments || 'Approved by Department Head';
  const previousStatus = requisition.status;

  // HOD approval → forward to stores review. A restock is stores' own request
  // for a shelf it already knows is short, so it goes straight to procurement.
  const isRestock = requisition.restock === true;
  requisition.status = isRestock ? 'pending_acceptance' : 'stores_review';
  requisition.hodApprovedBy = user._id;
  requisition.hodApprovedAt = new Date();

  if (needsOverride) {
    requisition.budgetOverride = {
      by: user._id,
      at: new Date(),
      reason: overrideReason,
      amountOverBudget: Math.abs(budgetCheck!.availableAfter)
    };
  }
  requisition.statusHistory.push({
    action: 'hod_approved',
    by: user._id,
    role: user.role,
    comments: needsOverride ? `${comments} — BUDGET OVERRIDE: ${overrideReason}` : comments
  });
  if (isRestock) {
    requisition.statusHistory.push({
      action: 'forwarded_to_procurement',
      by: user._id,
      role: user.role,
      comments: 'Restock for stores: no stock check needed'
    });
  }

  // Stock enquiry — populate storeAvailability on each line (paper IR stores check).
  if (requisition.site && !isRestock) {
    const enriched = await enrichRequisitionItemsWithAvailability(requisition.items as any[], requisition.site);
    requisition.items = enriched as any;
  }

  await requisition.save();

  // When every line is fully in stock at site, issue automatically (no manual stores step).
  let autoProcessed = false;
  if (!isRestock && (await canFullyFulfillFromStock(requisition))) {
    const { requisition: processed } = await processRequisitionAgainstStock(
      requisition,
      user,
      'Auto-issued on HOD approval — full stock available'
    );
    Object.assign(requisition, processed.toObject?.() ?? processed);
    autoProcessed = true;
  }

  const fresh = await PurchaseRequisition.findById(requisition._id);

  await createAuditLog({
    action: 'approve',
    entity: 'PurchaseRequisition',
    entityId: requisition._id,
    user,
    entityLabel: requisition.requisitionNumber,
    description: needsOverride
      ? `Approved requisition ${requisition.requisitionNumber} OVER BUDGET by ` +
        `${Math.abs(budgetCheck!.availableAfter).toFixed(2)}. Reason: ${overrideReason}`
      : `Approved requisition: ${requisition.requisitionNumber}`,
    previousData: { status: previousStatus, hodApproved: false },
    newData: {
      hodApproved: true,
      status: fresh?.status,
      autoProcessed,
      ownRequisition,
      ...(needsOverride ? { budgetOverride: requisition.budgetOverride } : {})
    },
    req
  });

  // Finance owns budget discipline, so an override is told to them directly
  // rather than waiting to be found in a report.
  if (needsOverride) {
    await notifyUsersByRole('finance', {
      type: 'requisition_submitted',
      title: 'Requisition approved over budget',
      message:
        `${requisition.requisitionNumber} was approved ${Math.abs(budgetCheck!.availableAfter).toFixed(2)} ` +
        `over the ${budgetCheck!.departmentName} budget for ${budgetCheck!.fiscalYear}. Reason: ${overrideReason}`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: user._id
    });
  }

  // Notify the requester, unless the requester is the one approving.
  if (!ownRequisition) {
    await createNotification({
      recipient: requisition.requestedBy,
      type: autoProcessed ? 'requisition_accepted' : 'requisition_approved',
      title: autoProcessed ? 'Requisition fulfilled from stores' : 'Requisition Approved',
      message: autoProcessed
        ? `Your requisition ${requisition.requisitionNumber} was approved and fully issued from stock (Issue No. ${fresh?.storesIssueNumber || '—'}).`
        : isRestock
        ? `Your restock ${requisition.requisitionNumber} has been approved by the Department Head and sent to Procurement.`
        : `Your requisition ${requisition.requisitionNumber} has been approved by the Department Head and sent to Stores.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: user._id
    });
  }

  if (isRestock) {
    await notifyUsersByRole('procurement_officer', {
      type: 'requisition_submitted',
      title: 'Restock ready for procurement',
      message: `Restock ${requisition.requisitionNumber} for stores was approved and needs acceptance.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: user._id
    });
  } else if (!autoProcessed) {
    await notifyUsersByRole('stores_officer', {
      type: 'requisition_submitted',
      title: 'Requisition awaiting stores review',
      message: `Requisition ${requisition.requisitionNumber} requires a stores availability check.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: user._id
    });
  } else {
    // Issued automatically, so the stock left the books without anyone in
    // stores touching it. Stores is told, to put the goods aside for the
    // department to collect.
    await notifyUsersByRole('stores_officer', {
      type: 'stock_issued',
      title: 'Issued from stock automatically',
      message: `${requisition.requisitionNumber} was approved and issued from stock (Issue No. ${fresh?.storesIssueNumber || '—'}). Set the goods aside for the department to collect.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: user._id
    });
  }

  return { requisition: fresh || requisition, autoProcessed };
}

export interface SubmissionResult {
  requisition: any;
  message: string;
  budgetCheck: BudgetCheck;
  autoProcessed: boolean;
}

/**
 * Submit a draft. A team member's request waits for the department head. A
 * head's own request needs no one else in the department to approve it, so
 * their submission is the department-head approval and it goes on to stores.
 */
export async function submitRequisitionForApproval(requisition: any, req: Request): Promise<SubmissionResult> {
  const user = req.user!;
  const previousStatus = requisition.status;

  // Check the request against the department's remaining budget (BRD FR-B3).
  // This flags rather than blocks: the procurement procedure (Rev 9) sets no
  // rule that an over-budget request must be refused, so the decision stays
  // with the approver, who now sees the position rather than guessing at it.
  const budgetCheck = await budgetPositionOf(requisition, 'submit');
  if (budgetCheck) {
    // Recorded on the requisition so the HOD sees the position as it stood at
    // submission, and so an auditor can see what the approver was told.
    requisition.budgetCheck = {
      checkedAt: new Date(),
      fiscalYear: budgetCheck.fiscalYear,
      requestAmount: budgetCheck.requestAmount,
      availableBefore: budgetCheck.availableBefore,
      availableAfter: budgetCheck.availableAfter,
      exceedsBudget: budgetCheck.exceedsBudget,
      hasAllocation: budgetCheck.hasAllocation,
      unpriced: budgetCheck.unpriced,
      message: budgetCheck.message
    };
  }

  const headSubmits = await headsRequisitionDepartment(user, requisition);

  requisition.statusHistory = requisition.statusHistory || [];
  requisition.statusHistory.push({
    action: 'submitted',
    by: user._id,
    role: user.role,
    comments: headSubmits
      ? 'Submitted by the department head'
      : budgetCheck?.exceedsBudget
        ? `Submitted for Department Head approval. OVER BUDGET: ${budgetCheck.message}`
        : 'Submitted for Department Head approval'
  });

  if (headSubmits) {
    requisition.status = 'pending_hod';
    await createAuditLog({
      action: 'submit',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user,
      entityLabel: requisition.requisitionNumber,
      description: `Submitted requisition: ${requisition.requisitionNumber} (raised by the department head)`,
      newData: { status: 'stores_review' },
      previousData: { status: previousStatus },
      req
    });

    // Submitting it is the head's decision to spend, over budget included;
    // Finance is told of an overrun as for any other override.
    const { requisition: approved, autoProcessed } = await approveAsDepartmentHead(requisition, req, {
      comments: 'Raised by the department head, so no separate department approval is needed',
      budgetCheck,
      overrideReason: 'Raised and submitted by the department head',
      ownRequisition: true
    });

    return {
      requisition: approved,
      budgetCheck,
      autoProcessed,
      message: autoProcessed
        ? 'Requisition issued from stock'
        : 'Requisition sent to stores. As department head, yours needs no further department approval.'
    };
  }

  // A team member's request → Department Head approval first
  requisition.status = 'pending_hod';
  await requisition.save();

  await createAuditLog({
    action: 'submit',
    entity: 'PurchaseRequisition',
    entityId: requisition._id,
    user,
    entityLabel: requisition.requisitionNumber,
    description: `Submitted requisition: ${requisition.requisitionNumber}`,
    newData: { status: 'pending_hod' },
    previousData: { status: previousStatus },
    req
  });

  if (requisition.department) {
    await notifyUsersByDepartment(requisition.department, {
      type: 'requisition_submitted',
      title: 'Requisition pending your approval',
      message: `Requisition ${requisition.requisitionNumber} requires Department Head approval.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: user._id
    }, user._id);
  } else {
    await notifyUsersByRole('department_head', {
      type: 'requisition_submitted',
      title: 'Requisition pending approval',
      message: `Requisition ${requisition.requisitionNumber} requires Department Head approval.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: user._id
    });
  }

  // Tell the approver, in the notification itself, that this one needs a
  // budget decision — otherwise the flag is only found by opening the record.
  if (budgetCheck?.exceedsBudget && requisition.department) {
    await notifyUsersByDepartment(requisition.department, {
      type: 'requisition_submitted',
      title: 'Over-budget requisition needs approval',
      message: `Requisition ${requisition.requisitionNumber} exceeds the ${budgetCheck.departmentName} budget for ${budgetCheck.fiscalYear}.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: user._id
    }, user._id);
  }

  return {
    requisition,
    budgetCheck,
    autoProcessed: false,
    message: budgetCheck?.exceedsBudget
      ? 'Requisition submitted. It exceeds the department budget and has been flagged for the approver.'
      : 'Requisition submitted for Department Head approval'
  };
}
