import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole, notifyUsersByDepartment } from '../../services/notification.service.js';

const submitRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Only draft requisitions can be submitted
    if (requisition.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit requisition with status: ${requisition.status}`
      });
    }

    // Ensure the user owns this requisition (admins may submit on behalf)
    if (
      req.user!.role !== 'admin' &&
      requisition.requestedBy.toString() !== req.user!._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit your own requisitions'
      });
    }

    // End user submits → Department Head approval first
    requisition.status = 'pending_hod';
    requisition.statusHistory = requisition.statusHistory || [];
    requisition.statusHistory.push({
      action: 'submitted',
      by: req.user!._id,
      role: req.user!.role,
      comments: 'Submitted for Department Head approval'
    });

    await requisition.save();

    await createAuditLog({
      action: 'submit',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Submitted requisition: ${requisition.requisitionNumber}`,
      newData: { status: 'pending_hod' },
      req
    });

    if (requisition.department) {
      await notifyUsersByDepartment(requisition.department, {
        type: 'requisition_submitted',
        title: 'Requisition pending your approval',
        message: `Requisition ${requisition.requisitionNumber} requires Department Head approval.`,
        entity: 'PurchaseRequisition',
        entityId: requisition._id,
        relatedUser: req.user!._id
      }, req.user!._id);
    } else {
      await notifyUsersByRole('department_head', {
        type: 'requisition_submitted',
        title: 'Requisition pending approval',
        message: `Requisition ${requisition.requisitionNumber} requires Department Head approval.`,
        entity: 'PurchaseRequisition',
        entityId: requisition._id,
        relatedUser: req.user!._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Requisition submitted for Department Head approval',
      data: requisition
    });
  } catch (error) {
    console.error('Submit requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default submitRequisition;
