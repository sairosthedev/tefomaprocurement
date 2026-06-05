import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

const rejectRequisition = async (req: Request, res: Response): Promise<any> => {
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

    if (
      req.user!.role !== 'admin' &&
      requisition.department?.toString() !== req.user!.department?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject requisitions from your department'
      });
    }

    requisition.status = 'rejected';
    requisition.statusHistory.push({
      action: 'rejected',
      by: req.user!._id,
      role: req.user!.role,
      comments: comments || 'Rejected by Department Head'
    });

    await requisition.save();

    await createAuditLog({
      action: 'reject',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Rejected requisition: ${requisition.requisitionNumber}`,
      newData: { status: 'rejected' },
      req
    });

    await createNotification({
      recipient: requisition.requestedBy,
      type: 'requisition_rejected',
      title: 'Requisition Rejected',
      message: `Your requisition ${requisition.requisitionNumber} was rejected by the Department Head.${comments ? ` Reason: ${comments}` : ''}`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Requisition rejected',
      data: requisition
    });
  } catch (error) {
    console.error('Reject requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default rejectRequisition;
