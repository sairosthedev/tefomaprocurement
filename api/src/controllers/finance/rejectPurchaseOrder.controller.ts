import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const rejectPurchaseOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
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

    // Allow rejection if PO is pending approvals and Finance hasn't approved yet
    if (po.status !== 'pending_approvals' || po.financeApproved) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not pending Finance approval'
      });
    }

    po.status = 'rejected';
    (po as any).approvalHistory.push({
      action: 'finance_rejected',
      by: req.user!._id,
      role: 'finance',
      comments: reason
    });

    await po.save();

    await createAuditLog({
      action: 'reject',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Finance rejected PO: ${po.poNumber}. Reason: ${reason}`,
      newData: { status: 'rejected' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Purchase order rejected',
      data: po
    });
  } catch (error) {
    console.error('Reject PO error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default rejectPurchaseOrder;
