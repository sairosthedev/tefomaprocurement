import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification, notifyUsersByRole } from '../../services/notification.service.js';
import { enrichRequisitionItemsWithAvailability } from '../../services/inventoryAvailability.service.js';
import {
  canFullyFulfillFromStock,
  processRequisitionAgainstStock
} from '../../services/storesRequisitionProcess.service.js';

// `req.user.department` is populated by the protect middleware, so it may be a
// document ({ _id, name, code }) rather than a raw ObjectId. Normalize either
// shape (and the requisition's unpopulated ObjectId) to a hex id for comparison.
const toIdString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

const approveRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    if (requisition.status !== 'pending_hod') {
      return res.status(400).json({
        success: false,
        message: 'Requisition is not pending Department Head approval'
      });
    }

    // Verify department head is approving their own department's requisition
    if (
      req.user!.role !== 'admin' &&
      toIdString(requisition.department) !== toIdString(req.user!.department)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only approve requisitions from your department'
      });
    }

    // HOD approval → forward to stores review
    requisition.status = 'stores_review';
    requisition.hodApprovedBy = req.user!._id;
    requisition.hodApprovedAt = new Date();
    requisition.statusHistory.push({
      action: 'hod_approved',
      by: req.user!._id,
      role: req.user!.role,
      comments: comments || 'Approved by Department Head'
    });

    // Stock enquiry — populate storeAvailability on each line (paper IR stores check).
    if (requisition.site) {
      const enriched = await enrichRequisitionItemsWithAvailability(
        requisition.items as any[],
        requisition.site
      );
      requisition.items = enriched as any;
    }

    await requisition.save();

    // When every line is fully in stock at site, issue automatically (no manual stores step).
    let autoProcessed = false;
    if (await canFullyFulfillFromStock(requisition)) {
      const { requisition: processed } = await processRequisitionAgainstStock(
        requisition,
        req.user!,
        'Auto-issued on HOD approval — full stock available'
      );
      Object.assign(requisition, processed.toObject?.() ?? processed);
      autoProcessed = true;
    }

    const fresh = await PurchaseRequisition.findById(requisition._id);

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Approved requisition: ${requisition.requisitionNumber}`,
      newData: { hodApproved: true, status: fresh?.status, autoProcessed },
      req
    });

    // Notify the requester
    await createNotification({
      recipient: requisition.requestedBy,
      type: autoProcessed ? 'requisition_accepted' : 'requisition_approved',
      title: autoProcessed ? 'Requisition fulfilled from stores' : 'Requisition Approved',
      message: autoProcessed
        ? `Your requisition ${requisition.requisitionNumber} was approved and fully issued from stock (Issue No. ${fresh?.storesIssueNumber || '—'}).`
        : `Your requisition ${requisition.requisitionNumber} has been approved by the Department Head and sent to Stores.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    if (!autoProcessed) {
      await notifyUsersByRole('stores_officer', {
        type: 'requisition_submitted',
        title: 'Requisition awaiting stores review',
        message: `Requisition ${requisition.requisitionNumber} requires a stores availability check.`,
        entity: 'PurchaseRequisition',
        entityId: requisition._id,
        relatedUser: req.user!._id
      });
    }

    res.status(200).json({
      success: true,
      message: autoProcessed
        ? 'Requisition approved and fully issued from stock'
        : 'Requisition approved and forwarded to stores',
      data: fresh || requisition,
      autoProcessed
    });
  } catch (error) {
    console.error('Approve requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default approveRequisition;
