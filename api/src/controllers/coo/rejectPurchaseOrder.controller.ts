import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole, notifySupplier } from '../../services/notification.service.js';

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

    if (!po.requiresCooApproval) {
      return res.status(400).json({
        success: false,
        message: 'COO authorization not required for this purchase order'
      });
    }

    const validStatuses = ['pending_coo', 'pending_approvals'];
    if (!validStatuses.includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not awaiting COO authorization'
      });
    }

    if (!po.hodApproved || !po.financeApproved) {
      return res.status(400).json({
        success: false,
        message: 'HOD and Finance approvals must be complete before COO can reject'
      });
    }

    if (po.cooApproved) {
      return res.status(400).json({ success: false, message: 'Already authorized by COO' });
    }

    po.status = 'rejected';
    po.cooApproved = false;
    po.approvalHistory.push({
      action: 'coo_rejected',
      by: req.user!._id,
      role: 'coo',
      comments: rejectionReason
    });

    await po.save();

    await createAuditLog({
      action: 'reject',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `COO rejected PO: ${po.poNumber}. Reason: ${rejectionReason}`,
      newData: { status: 'rejected' },
      req
    });

    await notifyUsersByRole('procurement_officer', {
      type: 'po_coo_rejected',
      title: 'PO rejected by COO',
      message: `Purchase Order ${po.poNumber} was rejected by the COO. Reason: ${rejectionReason}`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user!._id
    });

    await notifySupplier(po.supplier, {
      type: 'po_coo_rejected',
      title: 'Purchase Order Rejected',
      message: `Purchase Order ${po.poNumber} was not authorized.`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user!._id,
      metadata: { poNumber: po.poNumber, isSupplier: true }
    });

    res.status(200).json({
      success: true,
      message: 'Purchase order rejected',
      data: po
    });
  } catch (error) {
    console.error('COO reject PO error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default rejectPurchaseOrder;
