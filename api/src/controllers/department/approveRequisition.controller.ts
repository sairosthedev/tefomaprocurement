import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification, notifyUsersByRole } from '../../services/notification.service.js';
import { enrichRequisitionItemsWithAvailability } from '../../services/inventoryAvailability.service.js';
import {
  canFullyFulfillFromStock,
  processRequisitionAgainstStock
} from '../../services/storesRequisitionProcess.service.js';
import { canActOnDepartment } from '../../lib/departmentScope.js';
import { checkRequisitionAgainstBudget } from '../../services/budget.service.js';

const approveRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments, budgetOverrideReason } = req.body;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    if (requisition.status !== 'pending_hod') {
      return res.status(400).json({
        success: false,
        message: 'Requisition is not pending Department Head approval'
      });
    }

    // Verify department head is approving their own department's requisition
    if (!(await canActOnDepartment(req.user, requisition.department))) {
      return res.status(403).json({
        success: false,
        message: 'You can only approve requisitions from your department'
      });
    }

    // Budget gate (BRD FR-B3). Approval is the point where money is genuinely
    // committed, so the check is re-run here against the position as it stands
    // now rather than trusting the snapshot taken at submission — other
    // requests may have consumed the balance in between.
    //
    // An over-budget request is refused unless the approver supplies a reason.
    // Refusing outright would leave no way to handle a genuine emergency, and
    // the procurement procedure (Rev 9) sets no rule requiring one; recording
    // who overrode it and why gives Finance the audit trail instead.
    let budgetCheck = null;
    try {
      budgetCheck = await checkRequisitionAgainstBudget(requisition);
    } catch (error) {
      // A failure to compute must not silently permit an over-budget approval,
      // but neither should it block ordinary work, so it is logged and the
      // approval proceeds as it did before budgets existed.
      console.error('Budget check failed on approval:', error);
    }

    const needsOverride = budgetCheck?.exceedsBudget === true;
    const overrideReason = String(budgetOverrideReason || '').trim();

    if (needsOverride && !overrideReason) {
      return res.status(409).json({
        success: false,
        code: 'BUDGET_EXCEEDED',
        message: budgetCheck!.message,
        budgetCheck,
        // The client shows a confirmation asking for a reason, then retries.
        requiresBudgetOverride: true
      });
    }

    const previousStatus = requisition.status;

    // HOD approval → forward to stores review
    requisition.status = 'stores_review';
    requisition.hodApprovedBy = req.user!._id;
    requisition.hodApprovedAt = new Date();

    if (needsOverride) {
      requisition.budgetOverride = {
        by: req.user!._id,
        at: new Date(),
        reason: overrideReason,
        amountOverBudget: Math.abs(budgetCheck!.availableAfter)
      };
    }
    requisition.statusHistory.push({
      action: 'hod_approved',
      by: req.user!._id,
      role: req.user!.role,
      comments: needsOverride
        ? `${comments || 'Approved by Department Head'} — BUDGET OVERRIDE: ${overrideReason}`
        : comments || 'Approved by Department Head'
    });

    // Stock enquiry — populate storeAvailability on each line (paper IR stores check).
    if (requisition.site) {
      const enriched = await enrichRequisitionItemsWithAvailability(
        requisition.items as any[],
        requisition.site
      );
      requisition.items = enriched as any;
    }

    await requisition.save();

    // When every line is fully in stock at site, issue automatically (no manual stores step).
    let autoProcessed = false;
    if (await canFullyFulfillFromStock(requisition)) {
      const { requisition: processed } = await processRequisitionAgainstStock(
        requisition,
        req.user!,
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
      user: req.user,
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
        relatedUser: req.user!._id
      });
    }

    // Notify the requester
    await createNotification({
      recipient: requisition.requestedBy,
      type: autoProcessed ? 'requisition_accepted' : 'requisition_approved',
      title: autoProcessed ? 'Requisition fulfilled from stores' : 'Requisition Approved',
      message: autoProcessed
        ? `Your requisition ${requisition.requisitionNumber} was approved and fully issued from stock (Issue No. ${fresh?.storesIssueNumber || '—'}).`
        : `Your requisition ${requisition.requisitionNumber} has been approved by the Department Head and sent to Stores.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    if (!autoProcessed) {
      await notifyUsersByRole('stores_officer', {
        type: 'requisition_submitted',
        title: 'Requisition awaiting stores review',
        message: `Requisition ${requisition.requisitionNumber} requires a stores availability check.`,
        entity: 'PurchaseRequisition',
        entityId: requisition._id,
        relatedUser: req.user!._id
      });
    }

    res.status(200).json({
      success: true,
      message: autoProcessed
        ? 'Requisition approved and fully issued from stock'
        : 'Requisition approved and forwarded to stores',
      data: fresh || requisition,
      autoProcessed
    });
  } catch (error) {
    console.error('Approve requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default approveRequisition;
