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
 * Remove a single line item from a requisition during an approval stage.
 * An approver may drop items they don't want purchased (e.g. keep the monitor
 * and pencils, remove the keyboard) before approving the requisition onward.
 *
 * Authority:
 *  - pending_hod          → the requisition's department head (or admin)
 *  - pending_acceptance   → procurement officer / procurement head (or admin)
 */
const removeRequisitionItem = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id, itemId } = req.params;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }

    const role = req.user!.role;
    const status = requisition.status;

    // Items may only be trimmed while the requisition is awaiting approval.
    if (!['pending_hod', 'pending_acceptance'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Items can only be removed while the requisition is awaiting approval (current status: ${status}).`
      });
    }

    // Verify the user holds approval authority for this stage.
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

    // Don't allow emptying the requisition — reject it instead if nothing is wanted.
    if (requisition.items.length <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the only remaining item. Reject the requisition instead if nothing should be purchased.'
      });
    }

    const removedDescription = item.description;
    (requisition.items as any).pull(itemId);

    requisition.statusHistory.push({
      action: 'item_removed',
      by: req.user!._id,
      role,
      comments: `Removed item: ${removedDescription}`
    });

    await requisition.save(); // pre-save recalculates estimatedTotal

    await createAuditLog({
      action: 'update',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Removed item "${removedDescription}" from requisition ${requisition.requisitionNumber}`,
      newData: { removedItem: removedDescription, remainingItems: requisition.items.length },
      req
    });

    // Let the requester know an item was dropped from their request.
    await createNotification({
      recipient: requisition.requestedBy,
      type: 'requisition_updated',
      title: 'Item removed from your requisition',
      message: `"${removedDescription}" was removed from requisition ${requisition.requisitionNumber} during approval.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    const updated = await PurchaseRequisition.findById(requisition._id)
      .populate('requestedBy', 'firstName lastName email')
      .populate('department', 'name code');

    res.status(200).json({
      success: true,
      message: `Removed "${removedDescription}" from the requisition`,
      data: updated
    });
  } catch (error: any) {
    console.error('Remove requisition item error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default removeRequisitionItem;
