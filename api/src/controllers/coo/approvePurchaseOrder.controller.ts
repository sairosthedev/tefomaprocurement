import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const approvePurchaseOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const po = await PurchaseOrder.findById(id);
    if (!po || po.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Check if PO is pending approvals and COO hasn't approved yet
    if (po.status !== 'pending_approvals') {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not pending approvals'
      });
    }

    if (po.cooApproved) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order has already been approved by COO'
      });
    }

    // Mark COO approval
    po.cooApproved = true;
    po.cooApprovedBy = req.user!._id;
    po.cooApprovedAt = new Date();
    (po as any).approvalHistory.push({
      action: 'coo_approved',
      by: req.user!._id,
      role: 'coo',
      comments: comments || 'Approved by COO'
    });

    // Check if both approvals are complete
    if (po.financeApproved && po.cooApproved) {
      po.status = 'approved';
    }

    await po.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `COO approved PO: ${po.poNumber}`,
      newData: {
        cooApproved: true,
        status: po.status
      },
      req
    });

    res.status(200).json({
      success: true,
      message: po.status === 'approved'
        ? 'Purchase order approved by COO. All approvals complete.'
        : 'Purchase order approved by COO. Awaiting Finance approval.',
      data: po
    });
  } catch (error) {
    console.error('COO approve PO error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default approvePurchaseOrder;
