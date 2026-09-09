import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole, notifyUsersByDepartment } from '../../services/notification.service.js';
import { hasEnteredLineItems } from '../../lib/lineItems.js';
import { checkRequisitionAgainstBudget } from '../../services/budget.service.js';

const submitRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Only draft requisitions can be submitted
    if (requisition.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit requisition with status: ${requisition.status}`
      });
    }

    // Ensure the user owns this requisition (admins may submit on behalf)
    if (
      req.user!.role !== 'admin' &&
      requisition.requestedBy.toString() !== req.user!._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit your own requisitions'
      });
    }

    if (!hasEnteredLineItems(requisition.items)) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required before submitting'
      });
    }

    // Check the request against the department's remaining budget (BRD FR-B3).
    // This flags rather than blocks: the procurement procedure (Rev 9) sets no
    // rule that an over-budget request must be refused, so the decision stays
    // with the approver, who now sees the position rather than guessing at it.
    // A failure here must never stop someone submitting work, so it is caught.
    let budgetCheck = null;
    try {
      budgetCheck = await checkRequisitionAgainstBudget(requisition);
    } catch (error) {
      console.error('Budget check failed on submit:', error);
    }

    // End user submits → Department Head approval first
    const previousStatus = requisition.status;
    requisition.status = 'pending_hod';

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

    requisition.statusHistory = requisition.statusHistory || [];
    requisition.statusHistory.push({
      action: 'submitted',
      by: req.user!._id,
      role: req.user!.role,
      comments: budgetCheck?.exceedsBudget
        ? `Submitted for Department Head approval. OVER BUDGET: ${budgetCheck.message}`
        : 'Submitted for Department Head approval'
    });

    await requisition.save();

    await createAuditLog({
      action: 'submit',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
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
        relatedUser: req.user!._id
      }, req.user!._id);
    } else {
      await notifyUsersByRole('department_head', {
        type: 'requisition_submitted',
        title: 'Requisition pending approval',
        message: `Requisition ${requisition.requisitionNumber} requires Department Head approval.`,
        entity: 'PurchaseRequisition',
        entityId: requisition._id,
        relatedUser: req.user!._id
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
        relatedUser: req.user!._id
      }, req.user!._id);
    }

    res.status(200).json({
      success: true,
      message: budgetCheck?.exceedsBudget
        ? 'Requisition submitted. It exceeds the department budget and has been flagged for the approver.'
        : 'Requisition submitted for Department Head approval',
      data: requisition,
      budgetCheck
    });
  } catch (error) {
    console.error('Submit requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default submitRequisition;
