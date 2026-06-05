import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification, notifyUsersByRole } from '../../services/notification.service.js';

const approveRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

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
    if (
      req.user!.role !== 'admin' &&
      requisition.department?.toString() !== req.user!.department?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only approve requisitions from your department'
      });
    }

    // HOD approval → forward to stores review (FC-HQ-P-07 §6.3.2–6.3.3)
    requisition.status = 'stores_review';
    requisition.hodApprovedBy = req.user!._id;
    requisition.hodApprovedAt = new Date();
    requisition.statusHistory.push({
      action: 'hod_approved',
      by: req.user!._id,
      role: req.user!.role,
      comments: comments || 'Approved by Department Head'
    });

    await requisition.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Approved requisition: ${requisition.requisitionNumber}`,
      newData: { hodApproved: true, status: 'stores_review' },
      req
    });

    // Notify the requester
    await createNotification({
      recipient: requisition.requestedBy,
      type: 'requisition_approved',
      title: 'Requisition Approved',
      message: `Your requisition ${requisition.requisitionNumber} has been approved by the Department Head and sent to Stores.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    // Notify stores officers for the availability check
    await notifyUsersByRole('stores_officer', {
      type: 'requisition_submitted',
      title: 'Requisition awaiting stores review',
      message: `Requisition ${requisition.requisitionNumber} requires a stores availability check.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Requisition approved and forwarded to stores',
      data: requisition
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
