import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { canActOnDepartment } from '../../lib/departmentScope.js';
import { approveAsDepartmentHead, budgetPositionOf } from '../../services/requisitionApproval.service.js';

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

    // Verify department head is approving their own department's requisition.
    // That includes one they raised themselves: a head's own request has no one
    // above it in the department, and submitting one now counts as this
    // approval. This lets those submitted before that still move on.
    if (!(await canActOnDepartment(req.user, requisition.department))) {
      return res.status(403).json({
        success: false,
        message: 'You can only approve requisitions from your department'
      });
    }
    const ownRequisition = String(requisition.requestedBy) === String(req.user!._id);

    // Budget gate (BRD FR-B3). Approval is the point where money is genuinely
    // committed, so the check is re-run here against the position as it stands
    // now rather than trusting the snapshot taken at submission — other
    // requests may have consumed the balance in between.
    //
    // An over-budget request is refused unless the approver supplies a reason.
    // Refusing outright would leave no way to handle a genuine emergency, and
    // the procurement procedure (Rev 9) sets no rule requiring one; recording
    // who overrode it and why gives Finance the audit trail instead.
    //
    // A failure to compute must not silently permit an over-budget approval,
    // but neither should it block ordinary work, so it is logged and the
    // approval proceeds as it did before budgets existed.
    const budgetCheck = await budgetPositionOf(requisition, 'approval');

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

    const { requisition: approved, autoProcessed } = await approveAsDepartmentHead(requisition, req, {
      comments,
      budgetCheck,
      overrideReason,
      ownRequisition
    });

    res.status(200).json({
      success: true,
      message: autoProcessed
        ? 'Requisition approved and fully issued from stock'
        : 'Requisition approved and forwarded to stores',
      data: approved,
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
