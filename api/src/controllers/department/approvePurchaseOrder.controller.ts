import type { Request, Response } from 'express';
import { PurchaseOrder, PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';
import { isProcurementDepartment } from '@fossil/shared';

// Normalize a populated department doc or a raw ObjectId to a hex id string.
const toIdString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

/**
 * First HOD approval: the head of the department that raised the requisition.
 * Advances the PO to Procurement-HOD review. When the requesting department IS
 * Procurement, the two HOD steps collapse into this single approval and the PO
 * moves straight to Finance.
 */
const approvePurchaseOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const po = await PurchaseOrder.findById(id);
    if (!po || po.isDeleted) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    // Accept the legacy 'pending_hod' as an alias for 'pending_dept_hod'.
    const validStatuses = ['pending_dept_hod', 'pending_hod', 'pending_approvals'];
    if (!validStatuses.includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not awaiting Department HOD approval'
      });
    }

    if (po.deptHodApproved) {
      return res.status(400).json({ success: false, message: 'Already approved by the department HOD' });
    }

    // Resolve the requesting department from the linked requisition.
    let requestingDept: any = null;
    if (po.purchaseRequisition) {
      const requisition = await PurchaseRequisition.findById(po.purchaseRequisition)
        .populate('department', 'name code')
        .select('department');
      requestingDept = (requisition as any)?.department || null;
    }

    // Enforce same-department: only the head of the requesting department may
    // approve here (admins bypass). If we cannot resolve the department, fall
    // back to allowing any department head so the PO is not permanently stuck.
    if (req.user!.role !== 'admin' && requestingDept) {
      const sameDept = toIdString(requestingDept) === toIdString(req.user!.department);
      if (!sameDept) {
        return res.status(403).json({
          success: false,
          message: 'Only the head of the requesting department may approve this purchase order'
        });
      }
    }

    const previousStatus = po.status;

    po.deptHodApproved = true;
    po.deptHodApprovedBy = req.user!._id;
    po.deptHodApprovedAt = new Date();
    po.approvalHistory.push({
      action: 'dept_hod_approved',
      by: req.user!._id,
      role: req.user!.role,
      comments: comments || 'Approved by requesting-department HOD'
    });

    // Collapse rule: if the requesting department is Procurement, the same HOD
    // covers both steps — mark Procurement-HOD approved and go straight to Finance.
    const requestingIsProcurement = requestingDept
      ? isProcurementDepartment(requestingDept)
      : false;

    let nextStatus: string;
    if (requestingIsProcurement) {
      po.procHodApproved = true;
      po.procHodApprovedBy = req.user!._id;
      po.procHodApprovedAt = new Date();
      po.hodApproved = true;
      po.hodApprovedBy = req.user!._id;
      po.hodApprovedAt = new Date();
      po.status = 'pending_finance';
      nextStatus = 'pending_finance';
      po.approvalHistory.push({
        action: 'proc_hod_approved',
        by: req.user!._id,
        role: req.user!.role,
        comments: 'Requesting department is Procurement — HOD steps collapsed'
      });
    } else {
      po.status = 'pending_proc_hod';
      nextStatus = 'pending_proc_hod';
    }

    await po.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      entityLabel: po.poNumber,
      description: `Department HOD approved PO: ${po.poNumber}`,
      previousData: { status: previousStatus, deptHodApproved: false },
      newData: { status: nextStatus, deptHodApproved: true, collapsed: requestingIsProcurement },
      req
    });

    if (nextStatus === 'pending_finance') {
      await notifyUsersByRole('finance', {
        type: 'po_submitted',
        title: 'PO awaiting Finance approval',
        message: `Purchase Order ${po.poNumber} approved by HOD — Finance review required.`,
        entity: 'PurchaseOrder',
        entityId: po._id,
        relatedUser: req.user!._id
      });
    } else {
      await notifyUsersByRole('department_head', {
        type: 'po_submitted',
        title: 'PO awaiting Procurement HOD approval',
        message: `Purchase Order ${po.poNumber} approved by the requesting department — Procurement HOD approval required.`,
        entity: 'PurchaseOrder',
        entityId: po._id,
        relatedUser: req.user!._id
      });
    }

    res.status(200).json({
      success: true,
      message: requestingIsProcurement
        ? 'Purchase order approved by HOD. Awaiting Finance Manager approval.'
        : 'Purchase order approved by department HOD. Awaiting Procurement HOD approval.',
      data: po
    });
  } catch (error) {
    console.error('Dept HOD approve PO error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default approvePurchaseOrder;
