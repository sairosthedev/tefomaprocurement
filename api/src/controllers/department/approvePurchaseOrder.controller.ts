import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';

const approvePurchaseOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const po = await PurchaseOrder.findById(id);
    if (!po || po.isDeleted) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    const validStatuses = ['pending_hod', 'pending_approvals'];
    if (!validStatuses.includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not awaiting HOD approval'
      });
    }

    if (po.hodApproved) {
      return res.status(400).json({ success: false, message: 'Already approved by HOD' });
    }

    po.hodApproved = true;
    po.hodApprovedBy = req.user!._id;
    po.hodApprovedAt = new Date();
    po.status = 'pending_finance';
    po.approvalHistory.push({
      action: 'hod_approved',
      by: req.user!._id,
      role: req.user!.role,
      comments: comments || 'Approved by HOD (FC-HQ-P-07 §6.3.12)'
    });

    await po.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `HOD approved PO: ${po.poNumber}`,
      newData: { status: 'pending_finance' },
      req
    });

    await notifyUsersByRole('finance', {
      type: 'po_submitted',
      title: 'PO awaiting Finance approval',
      message: `Purchase Order ${po.poNumber} approved by HOD — Finance review required.`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Purchase order approved by HOD. Awaiting Finance Manager approval.',
      data: po
    });
  } catch (error) {
    console.error('HOD approve PO error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default approvePurchaseOrder;
