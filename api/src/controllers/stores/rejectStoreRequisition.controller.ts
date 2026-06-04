import type { Request, Response } from 'express';

import { StoreRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

const rejectStoreRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    if (!comments || !comments.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comments are required for rejection'
      });
    }

    const requisition = await StoreRequisition.findById(id);
    
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Store requisition not found'
      });
    }

    if (!['pending', 'approved'].includes(requisition.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a store requisition with status: ${requisition.status}`
      });
    }

    // Reject the requisition
    (requisition as any).status = 'rejected';
    (requisition as any).notes = (requisition.notes || '') + `\nRejection reason: ${comments}`;
    
    await requisition.save();

    await createAuditLog({
      action: 'reject',
      entity: 'StoreRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Rejected store requisition ${requisition.requisitionNumber}`,
      newData: { status: 'rejected', comments },
      req
    });

    // Notify the requester
    await createNotification({
      recipient: requisition.requestedBy,
      type: 'store_requisition_rejected',
      title: 'Store Requisition Rejected',
      message: `Your store requisition ${requisition.requisitionNumber} has been rejected. Reason: ${comments}`,
      entity: 'StoreRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id,
      metadata: { reason: comments }
    });

    const populatedRequisition = await StoreRequisition.findById(requisition._id)
      .populate('requestedBy', 'firstName lastName')
      .populate('department', 'name')
      .populate('items.item', 'code name description unit');

    res.status(200).json({
      success: true,
      message: 'Store requisition rejected',
      data: populatedRequisition
    });
  } catch (error: any) {
    console.error('Reject store requisition error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default rejectStoreRequisition;
