import type { Request, Response } from 'express';

import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

const acceptRequisition = async (req: Request, res: Response): Promise<any> => {
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

    if (requisition.status !== 'pending_acceptance') {
      return res.status(400).json({
        success: false,
        message: 'Requisition is not pending acceptance'
      });
    }

    (requisition as any).status = 'accepted';
    (requisition as any).processedBy = req.user!._id;
    (requisition as any).statusHistory = requisition.statusHistory || [];
    (requisition as any).statusHistory.push({
      action: 'accepted',
      by: req.user!._id,
      role: req.user!.role,
      comments: comments || 'Accepted by Procurement'
    });

    await requisition.save();

    await createAuditLog({
      action: 'status_change',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Procurement accepted requisition: ${requisition.requisitionNumber}`,
      previousData: { status: 'pending_acceptance' },
      newData: { status: 'accepted' },
      req
    });

    // Notify the requester
    await createNotification({
      recipient: requisition.requestedBy,
      type: 'requisition_accepted',
      title: 'Requisition Accepted',
      message: `Your requisition ${requisition.requisitionNumber} has been accepted by Procurement and is being processed.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Requisition accepted',
      data: requisition
    });
  } catch (error: any) {
    console.error('Accept requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default acceptRequisition;
