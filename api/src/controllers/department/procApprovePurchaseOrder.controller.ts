import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';
import { isProcurementHead } from '@fossil/shared';

/**
 * Second HOD approval: the head of the Procurement department. Runs after the
 * requesting-department HOD and advances the PO to Finance review. Sets the
 * legacy hodApproved flag so downstream Finance queries continue to work.
 */
const procApprovePurchaseOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    if (req.user!.role !== 'admin' && !isProcurementHead(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only the Head of Procurement may authorize this step'
      });
    }

    const po = await PurchaseOrder.findById(id);
    if (!po || po.isDeleted) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (po.status !== 'pending_proc_hod') {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not awaiting Procurement HOD approval'
      });
    }

    if (!po.deptHodApproved) {
      return res.status(400).json({
        success: false,
        message: 'Requesting-department HOD approval is required first'
      });
    }

    if (po.procHodApproved) {
      return res.status(400).json({ success: false, message: 'Already approved by Procurement HOD' });
    }

    po.procHodApproved = true;
    po.procHodApprovedBy = req.user!._id;
    po.procHodApprovedAt = new Date();
    // Both HOD steps complete — set the legacy combined flag for Finance queries.
    po.hodApproved = true;
    po.hodApprovedBy = req.user!._id;
    po.hodApprovedAt = new Date();
    po.status = 'pending_finance';
    po.approvalHistory.push({
      action: 'proc_hod_approved',
      by: req.user!._id,
      role: req.user!.role,
      comments: comments || 'Approved by Procurement HOD'
    });

    await po.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Procurement HOD approved PO: ${po.poNumber}`,
      newData: { status: 'pending_finance', procHodApproved: true },
      req
    });

    await notifyUsersByRole('finance', {
      type: 'po_submitted',
      title: 'PO awaiting Finance approval',
      message: `Purchase Order ${po.poNumber} approved by Procurement HOD — Finance review required.`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Purchase order approved by Procurement HOD. Awaiting Finance Manager approval.',
      data: po
    });
  } catch (error) {
    console.error('Procurement HOD approve PO error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default procApprovePurchaseOrder;
