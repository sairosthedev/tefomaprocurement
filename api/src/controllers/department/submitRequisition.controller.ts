import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { hasEnteredLineItems } from '../../lib/lineItems.js';
import { submitRequisitionForApproval } from '../../services/requisitionApproval.service.js';

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

    // Only the requester submits: submitting is their statement that the
    // request is complete, which nobody else can make for them.
    if (requisition.requestedBy.toString() !== req.user!._id.toString()) {
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

    // A team member's request goes to the department head; a head's own goes
    // straight on to stores.
    const { requisition: submitted, message, budgetCheck } = await submitRequisitionForApproval(requisition, req);

    res.status(200).json({
      success: true,
      message,
      data: submitted,
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
