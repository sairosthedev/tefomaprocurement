import type { Request, Response } from 'express';
import { validatePurchaseOrderCancellation } from '@fossil/shared';
import { createAuditLog } from '../../middleware/index.js';
import { refuseInvalid } from '../../lib/validation.js';
import { createNotification, notifySupplier } from '../../services/notification.service.js';
import {
  cancelPurchaseOrderById,
  CancellationError
} from '../../services/cancellation.service.js';

const cancelPurchaseOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reasonCode, reason, comments } = req.body;
    // `reason` and `reasonDetails` are older names for the code and the details.
    const code = reasonCode || reason;
    const details = comments || req.body.reasonDetails;
    if (refuseInvalid(res, validatePurchaseOrderCancellation({ reasonCode: code, comments: details }))) return;

    const { po, prUpdated } = await cancelPurchaseOrderById(
      id,
      req.user!,
      code,
      details
    );

    await createAuditLog({
      action: 'cancel',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Cancelled PO: ${po.poNumber}`,
      newData: {
        status: 'cancelled',
        reason: po.cancellationReason,
        prUpdated
      },
      req
    });

    await notifySupplier(po.supplier, {
      type: 'po_cancelled',
      title: 'Purchase order cancelled',
      message: `Purchase order ${po.poNumber} has been cancelled. Reason: ${po.cancellationReason}`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user!._id,
      metadata: { poNumber: po.poNumber, isSupplier: true }
    });

    if (po.createdBy) {
      await createNotification({
        recipient: po.createdBy,
        type: 'po_cancelled',
        title: 'Purchase order cancelled',
        message: `PO ${po.poNumber} was cancelled.`,
        entity: 'PurchaseOrder',
        entityId: po._id,
        relatedUser: req.user!._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Purchase order cancelled',
      data: { po, prUpdated }
    });
  } catch (error) {
    if (error instanceof CancellationError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    console.error('Cancel purchase order error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default cancelPurchaseOrder;
