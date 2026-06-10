import type { Request, Response } from 'express';
import { isProcurementHead } from '@fossil/shared';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

// `req.user.department` is populated by the protect middleware, so it may be a
// document rather than a raw ObjectId. Normalize either shape to a hex id.
const toIdString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

/**
 * Update a single line item on a requisition during an approval stage — currently
 * the requested quantity (e.g. an approver trims 5 monitors down to 2).
 *
 * Authority mirrors removeRequisitionItem:
 *  - pending_hod          → the requisition's department head (or admin)
 *  - pending_acceptance   → procurement officer / procurement head (or admin)
 */
const updateRequisitionItem = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id, itemId } = req.params;
    const { quantity } = req.body;

    const parsedQty = Number(quantity);
    if (!Number.isFinite(parsedQty) || parsedQty < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be a whole number of at least 1.' });
    }

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }

    const role = req.user!.role;
    const status = requisition.status;

    if (!['pending_hod', 'pending_acceptance'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Items can only be edited while the requisition is awaiting approval (current status: ${status}).`
      });
    }

    let authorized = false;
    if (role === 'admin') {
      authorized = true;
    } else if (status === 'pending_hod' && role === 'department_head') {
      authorized = toIdString(requisition.department) === toIdString(req.user!.department);
    } else if (
      status === 'pending_acceptance' &&
      (role === 'procurement_officer' || isProcurementHead(req.user))
    ) {
      authorized = true;
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify items on this requisition at its current stage.'
      });
    }

    const item = (requisition.items as any).id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found on this requisition' });
    }

    const previousQty = item.quantity;
    if (parsedQty === previousQty) {
      return res.status(400).json({ success: false, message: 'Quantity is unchanged.' });
    }

    const wholeQty = Math.floor(parsedQty);
    item.quantity = wholeQty;
    // Keep the line total in step with the new quantity when a unit price exists.
    if (item.estimatedUnitPrice != null) {
      item.estimatedTotalPrice = item.estimatedUnitPrice * wholeQty;
    }

    requisition.statusHistory.push({
      action: 'item_removed',
      by: req.user!._id,
      role,
      comments: `Adjusted quantity for "${item.description}" from ${previousQty} to ${wholeQty}`
    });

    await requisition.save(); // pre-save recalculates estimatedTotal

    await createAuditLog({
      action: 'update',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Changed quantity of "${item.description}" from ${previousQty} to ${wholeQty} on requisition ${requisition.requisitionNumber}`,
      previousData: { quantity: previousQty },
      newData: { quantity: wholeQty },
      req
    });

    await createNotification({
      recipient: requisition.requestedBy,
      type: 'requisition_updated',
      title: 'Quantity adjusted on your requisition',
      message: `Quantity for "${item.description}" was changed from ${previousQty} to ${wholeQty} on requisition ${requisition.requisitionNumber} during approval.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    const updated = await PurchaseRequisition.findById(requisition._id)
      .populate('requestedBy', 'firstName lastName email')
      .populate('department', 'name code');

    res.status(200).json({
      success: true,
      message: `Updated quantity for "${item.description}" to ${wholeQty}`,
      data: updated
    });
  } catch (error: any) {
    console.error('Update requisition item error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default updateRequisitionItem;
