import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';

const forwardRequisitionToProcurement = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }

    if (requisition.status !== 'stores_review') {
      return res.status(400).json({
        success: false,
        message: 'Requisition is not in stores review'
      });
    }

    requisition.status = 'pending_acceptance';
    requisition.storesReviewedBy = req.user!._id;
    requisition.storesReviewedAt = new Date();
    requisition.storesReviewNotes = notes || 'Forwarded to procurement — stock unavailable';
    requisition.statusHistory.push({
      action: 'forwarded_to_procurement',
      by: req.user!._id,
      role: req.user!.role,
      comments: notes || 'Forwarded to procurement (FC-HQ-P-07 §6.3.2)'
    });

    await requisition.save();

    await createAuditLog({
      action: 'status_change',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Forwarded PR ${requisition.requisitionNumber} to procurement`,
      newData: { status: 'pending_acceptance' },
      req
    });

    await notifyUsersByRole('procurement_officer', {
      type: 'requisition_submitted',
      title: 'Requisition ready for procurement',
      message: `Requisition ${requisition.requisitionNumber} passed stores review and requires acceptance.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Requisition forwarded to procurement queue',
      data: requisition
    });
  } catch (error) {
    console.error('Forward to procurement error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default forwardRequisitionToProcurement;
