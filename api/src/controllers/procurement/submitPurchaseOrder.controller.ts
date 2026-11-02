import type { Request, Response } from 'express';
import { PurchaseOrder, User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotifications } from '../../services/notification.service.js';
import { isProcurementHead } from '@fossil/shared';
import { applyCooAssessment, describeCooAssessment } from '../../services/poApprovalFlow.service.js';

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

    // Sequential: Procurement HOD → Finance → COO (at or above the SBU's USD limit)
    po.status = 'pending_proc_hod';
    po.deptHodApproved = true; // step removed — auto-cleared
    po.procHodApproved = false;
    po.hodApproved = false;
    po.financeApproved = false;
    po.cooApproved = false;
    po.deptHodApprovedBy = undefined;
    po.deptHodApprovedAt = undefined;
    po.procHodApprovedBy = undefined;
    po.procHodApprovedAt = undefined;
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
      comments: 'Submitted for Procurement HOD approval'
    });

    // Re-assessed at submission against today's rate and limit, whatever the
    // draft recorded when it was created.
    await applyCooAssessment(po);

    await po.save();

    await createAuditLog({
      action: 'submit',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Submitted PO: ${po.poNumber} for HOD approval`,
      newData: {
        status: 'pending_proc_hod',
        requiresCooApproval: po.requiresCooApproval,
        currency: po.currency,
        totalAmountUsd: po.totalAmountUsd,
        fxRateToUsd: po.fxRateToUsd,
        cooThresholdUsd: po.cooThresholdUsd
      },
      req
    });

    // A submitted PO now goes straight to the Head of Procurement, so they are
    // the one to tell; without this nothing pointed them at it.
    const heads = (
      await User.find({ role: 'department_head', status: 'active', isDeleted: false })
        .select('_id email firstName lastName role department')
        .populate('department', 'name code')
    ).filter((u: any) => isProcurementHead(u));
    if (heads.length) await createNotifications(heads, {
      type: 'po_submitted',
      title: 'PO awaiting your approval',
      message: `Purchase Order ${po.poNumber} was submitted and needs Head of Procurement approval.`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: po.requiresCooApproval
        ? `Purchase order submitted. Awaiting Procurement HOD → Finance → COO approval (${describeCooAssessment(po)}).`
        : 'Purchase order submitted. Awaiting Procurement HOD → Finance approval.',
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
