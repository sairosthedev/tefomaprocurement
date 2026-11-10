import type { Request, Response } from 'express';
import { PR_CANCELLATION_REASONS, prCancelStatusesFor, validateRequisitionCancellation } from '@fossil/shared';
import { createAuditLog } from '../../middleware/index.js';
import { refuseInvalid } from '../../lib/validation.js';
import { createNotification, notifyUsersByRole } from '../../services/notification.service.js';
import {
  cancelRequisitionById,
  CancellationError
} from '../../services/cancellation.service.js';

const cancelRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reasonCode, reason, comments } = req.body;
    // `reason` and `reasonDetails` are older names for the code and the details.
    const code = reasonCode || reason;
    const details = comments || req.body.reasonDetails;
    if (refuseInvalid(res, validateRequisitionCancellation({ reasonCode: code, comments: details }))) return;

    const result = await cancelRequisitionById(
      id,
      req.user!,
      code,
      details
    );

    const { requisition, cancelledRfqs, cancelledPos } = result;

    await createAuditLog({
      action: 'cancel',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Cancelled requisition: ${requisition.requisitionNumber}`,
      newData: {
        status: 'cancelled',
        reason: requisition.cancellationReason,
        cancelledRfqs,
        cancelledPos
      },
      req
    });

    await createNotification({
      recipient: requisition.requestedBy,
      type: 'requisition_cancelled',
      title: 'Requisition cancelled',
      message: `Requisition ${requisition.requisitionNumber} was cancelled. Reason: ${requisition.cancellationReason}`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    if (req.user!.role !== 'procurement_officer' && req.user!.role !== 'admin') {
      await notifyUsersByRole('procurement_officer', {
        type: 'requisition_cancelled',
        title: 'Requisition cancelled',
        message: `Requisition ${requisition.requisitionNumber} was cancelled.`,
        entity: 'PurchaseRequisition',
        entityId: requisition._id,
        relatedUser: req.user!._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Requisition cancelled',
      data: {
        requisition,
        cancelledRfqs,
        cancelledPos
      }
    });
  } catch (error) {
    if (error instanceof CancellationError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    console.error('Cancel requisition error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getRequisitionCancellationMeta = async (req: Request, res: Response): Promise<any> => {
  const allowedStatuses = prCancelStatusesFor(req.user);

  res.status(200).json({
    success: true,
    data: {
      reasons: PR_CANCELLATION_REASONS,
      allowedStatuses
    }
  });
};

export default cancelRequisition;
