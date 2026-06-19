import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';

const rejectPurchaseOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason, comments } = req.body;
    const rejectionReason = (reason || comments || '').trim();

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const po = await PurchaseOrder.findById(id);
    if (!po || po.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    const validStatuses = ['pending_hod', 'pending_approvals'];
    if (!validStatuses.includes(po.status) || po.hodApproved) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not pending HOD approval'
      });
    }

    po.status = 'rejected';
    po.hodApproved = false;
    po.approvalHistory.push({
      action: 'hod_rejected',
      by: req.user!._id,
      role: req.user!.role,
      comments: rejectionReason
    });

    await po.save();

    await createAuditLog({
      action: 'reject',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `HOD rejected PO: ${po.poNumber}. Reason: ${rejectionReason}`,
      newData: { status: 'rejected' },
      req
    });

    await notifyUsersByRole('procurement_officer', {
      type: 'po_finance_rejected',
      title: 'PO rejected by HOD',
      message: `Purchase Order ${po.poNumber} was rejected by the department head.`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Purchase order rejected',
      data: po
    });
  } catch (error) {
    console.error('HOD reject PO error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default rejectPurchaseOrder;
