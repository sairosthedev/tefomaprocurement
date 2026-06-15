import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { requiresCooApproval } from '../../services/poApprovalFlow.service.js';

const submitPurchaseOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const po = await PurchaseOrder.findById(id);
    if (!po || po.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (po.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit purchase order with status: ${po.status}. Only draft purchase orders can be submitted.`
      });
    }

    // Sequential: Procurement → HOD → Finance → COO (if > USD 5k)
    po.status = 'pending_hod';
    po.hodApproved = false;
    po.financeApproved = false;
    po.cooApproved = false;
    po.requiresCooApproval = requiresCooApproval(po.totalAmount);
    po.hodApprovedBy = undefined;
    po.hodApprovedAt = undefined;
    po.financeApprovedBy = undefined;
    po.financeApprovedAt = undefined;
    po.cooApprovedBy = undefined;
    po.cooApprovedAt = undefined;
    po.approvalHistory.push({
      action: 'submitted',
      by: req.user!._id,
      role: req.user!.role,
      comments: 'Submitted for HOD approval'
    });

    await po.save();

    await createAuditLog({
      action: 'submit',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Submitted PO: ${po.poNumber} for HOD approval`,
      newData: { status: 'pending_hod', requiresCooApproval: po.requiresCooApproval },
      req
    });

    res.status(200).json({
      success: true,
      message: po.requiresCooApproval
        ? 'Purchase order submitted. Awaiting HOD → Finance → COO approval (amount ≥ USD 5,000).'
        : 'Purchase order submitted. Awaiting HOD → Finance approval.',
      data: po
    });
  } catch (error: any) {
    console.error('Submit PO error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default submitPurchaseOrder;
