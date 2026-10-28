import type { Request, Response } from 'express';
import { PurchaseOrder, PurchaseRequisition } from '../../models/index.js';
import { isProcurementHead } from '@fossil/shared';

const toIdString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};
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

    const validStatuses = ['pending_dept_hod', 'pending_proc_hod', 'pending_hod', 'pending_approvals'];
    if (!validStatuses.includes(po.status) || po.hodApproved) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not pending HOD approval'
      });
    }

    // Rejecting is the other half of approving, so it belongs to whoever holds
    // the step the PO is at: the Head of Procurement at their step, otherwise
    // the head of the department that raised the requisition.
    if (req.user!.role !== 'admin') {
      if (po.status === 'pending_proc_hod') {
        if (!isProcurementHead(req.user)) {
          return res.status(403).json({
            success: false,
            message: 'Only the Head of Procurement can reject at this step'
          });
        }
      } else {
        const requisition = po.purchaseRequisition
          ? await PurchaseRequisition.findById(po.purchaseRequisition).select('department')
          : null;
        const deptId = toIdString((requisition as any)?.department);
        const allowed = deptId
          ? deptId === toIdString(req.user!.department)
          : isProcurementHead(req.user);
        if (!allowed) {
          return res.status(403).json({
            success: false,
            message: 'Only the head of the requesting department may reject this purchase order'
          });
        }
      }
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
