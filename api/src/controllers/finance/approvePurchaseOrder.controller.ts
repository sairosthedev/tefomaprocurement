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

    const validStatuses = ['pending_finance', 'pending_approvals'];
    if (!validStatuses.includes(po.status) && !(po.status === 'pending_hod' && po.hodApproved)) {
      if (po.status !== 'pending_finance' && !(po.status === 'pending_approvals' && po.hodApproved && !po.financeApproved)) {
        return res.status(400).json({
          success: false,
          message: 'Purchase order is not awaiting Finance approval'
        });
      }
    }

    if (!po.hodApproved) {
      return res.status(400).json({
        success: false,
        message: 'HOD approval is required before Finance can approve'
      });
    }

    if (po.financeApproved) {
      return res.status(400).json({ success: false, message: 'Already approved by Finance' });
    }

    po.financeApproved = true;
    po.financeApprovedBy = req.user!._id;
    po.financeApprovedAt = new Date();
    po.approvalHistory.push({
      action: 'finance_approved',
      by: req.user!._id,
      role: 'finance',
      comments: comments || 'Approved by Finance Manager'
    });

    if (po.requiresCooApproval) {
      po.status = 'pending_coo';
    } else {
      po.status = 'approved';
    }

    await po.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Finance approved PO: ${po.poNumber}`,
      newData: { status: po.status, financeApproved: true },
      req
    });

    if (po.status === 'pending_coo') {
      await notifyUsersByRole('coo', {
        type: 'po_finance_approved',
        title: 'PO awaiting COO authorization',
        message: `PO ${po.poNumber} (≥ USD 5,000) requires COO authorization.`,
        entity: 'PurchaseOrder',
        entityId: po._id,
        relatedUser: req.user!._id
      });
    } else {
      await notifyUsersByRole('procurement_officer', {
        type: 'po_finance_approved',
        title: 'Purchase Order fully approved',
        message: `PO ${po.poNumber} is approved and ready for issuance.`,
        entity: 'PurchaseOrder',
        entityId: po._id,
        relatedUser: req.user!._id
      });
      await notifySupplier(po.supplier, {
        type: 'po_coo_approved',
        title: 'Purchase Order Approved',
        message: `Purchase Order ${po.poNumber} has been approved.`,
        entity: 'PurchaseOrder',
        entityId: po._id,
        relatedUser: req.user!._id,
        metadata: { poNumber: po.poNumber, isSupplier: true }
      });
    }

    res.status(200).json({
      success: true,
      message: po.status === 'approved'
        ? 'Purchase order approved by Finance. All approvals complete.'
        : 'Finance approved. Awaiting COO authorization (amount ≥ USD 5,000).',
      data: po
    });
  } catch (error) {
    console.error('Approve PO error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default approvePurchaseOrder;
