import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole, notifySupplier } from '../../services/notification.service.js';

const approvePurchaseOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const po = await PurchaseOrder.findById(id);
    if (!po || po.isDeleted) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (!po.requiresCooApproval) {
      return res.status(400).json({
        success: false,
        message: 'COO authorization not required for this purchase order (below USD 5,000 threshold)'
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
        message: 'HOD and Finance approvals must be complete before COO authorization'
      });
    }

    if (po.cooApproved) {
      return res.status(400).json({ success: false, message: 'Already authorized by COO' });
    }

    po.cooApproved = true;
    po.cooApprovedBy = req.user!._id;
    po.cooApprovedAt = new Date();
    po.status = 'approved';
    po.approvalHistory.push({
      action: 'coo_approved',
      by: req.user!._id,
      role: 'coo',
      comments: comments || 'Authorized by COO'
    });

    await po.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `COO authorized PO: ${po.poNumber}`,
      newData: { status: 'approved', cooApproved: true },
      req
    });

    await notifyUsersByRole('procurement_officer', {
      type: 'po_coo_approved',
      title: 'Purchase Order fully authorized',
      message: `PO ${po.poNumber} has COO authorization and is ready for issuance.`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user!._id
    });

    await notifySupplier(po.supplier, {
      type: 'po_coo_approved',
      title: 'Purchase Order Approved',
      message: `Purchase Order ${po.poNumber} has been fully authorized.`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user!._id,
      metadata: { poNumber: po.poNumber, isSupplier: true }
    });

    res.status(200).json({
      success: true,
      message: 'Purchase order authorized by COO. All approvals complete.',
      data: po
    });
  } catch (error) {
    console.error('COO approve PO error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default approvePurchaseOrder;
