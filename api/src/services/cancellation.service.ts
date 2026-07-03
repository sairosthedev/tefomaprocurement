import mongoose from 'mongoose';
import {
  PR_CANCEL_BY_ROLE,
  PR_TERMINAL_STATUSES,
  PO_CANCEL_BY_ROLE,
  PO_TERMINAL_STATUSES,
  getPoCancellationReasonLabel,
  getPrCancellationReasonLabel,
  isValidPoCancellationReason,
  isValidPrCancellationReason
} from '@fossil/shared';
import {
  PurchaseRequisition,
  PurchaseOrder,
  RFQ,
  Delivery,
  Invoice
} from '../models/index.js';

const ACTIVE_INVOICE_STATUSES = ['submitted', 'variance', 'approved', 'partially_paid', 'paid'];
const OPEN_RFQ_STATUSES = ['draft', 'open', 'closed', 'evaluating'];
const CANCELLABLE_PO_STATUSES = [
  'draft',
  'pending_hod',
  'pending_finance',
  'pending_coo',
  'pending_approvals',
  'rejected',
  'approved'
];

export class CancellationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const toIdString = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
};

function formatReason(code: string, details?: string): string {
  const label = getPrCancellationReasonLabel(code);
  if (code === 'other' && details?.trim()) {
    return details.trim();
  }
  return details?.trim() ? `${label}: ${details.trim()}` : label;
}

function formatPoReason(code: string, details?: string): string {
  const label = getPoCancellationReasonLabel(code);
  if (code === 'other' && details?.trim()) {
    return details.trim();
  }
  return details?.trim() ? `${label}: ${details.trim()}` : label;
}

export function assertCanCancelRequisition(
  user: { _id: unknown; role: string; department?: unknown },
  requisition: { status: string; requestedBy: unknown; department?: unknown }
): void {
  if ((PR_TERMINAL_STATUSES as readonly string[]).includes(requisition.status)) {
    throw new CancellationError(`Cannot cancel a requisition with status "${requisition.status}"`);
  }

  const allowed = PR_CANCEL_BY_ROLE[user.role];
  if (!allowed?.includes(requisition.status)) {
    throw new CancellationError('You are not authorized to cancel this requisition at its current stage');
  }

  if (user.role === 'end_user') {
    if (toIdString(requisition.requestedBy) !== toIdString(user._id)) {
      throw new CancellationError('You can only cancel your own requisitions', 403);
    }
  }

  if (user.role === 'department_head') {
    if (toIdString(requisition.department) !== toIdString(user.department)) {
      throw new CancellationError('You can only cancel requisitions from your department', 403);
    }
  }
}

export function assertCanCancelPurchaseOrder(
  user: { role: string },
  po: { status: string }
): void {
  if ((PO_TERMINAL_STATUSES as readonly string[]).includes(po.status)) {
    throw new CancellationError(
      `Cannot cancel a purchase order that is ${po.status.replace(/_/g, ' ')}`
    );
  }

  const allowed = PO_CANCEL_BY_ROLE[user.role];
  if (!allowed?.includes(po.status)) {
    throw new CancellationError('You are not authorized to cancel this purchase order at its current stage');
  }
}

async function assertPoHasNoBlockers(poId: mongoose.Types.ObjectId | string): Promise<void> {
  const [activeInvoice, delivery] = await Promise.all([
    Invoice.findOne({
      purchaseOrder: poId,
      isDeleted: false,
      status: { $in: ACTIVE_INVOICE_STATUSES }
    }).select('_id invoiceNumber status'),
    Delivery.findOne({
      purchaseOrder: poId,
      isDeleted: false,
      status: { $ne: 'rejected' }
    }).select('_id grvNumber status')
  ]);

  if (activeInvoice) {
    throw new CancellationError(
      `Cannot cancel: invoice ${activeInvoice.invoiceNumber || activeInvoice._id} is ${activeInvoice.status}`
    );
  }

  if (delivery) {
    throw new CancellationError(
      `Cannot cancel: goods receipt ${delivery.grvNumber || delivery._id} already exists`
    );
  }
}

async function findLinkedPurchaseOrders(requisitionId: mongoose.Types.ObjectId | string) {
  const rfqIds = await RFQ.find({
    purchaseRequisition: requisitionId,
    isDeleted: false
  }).distinct('_id');

  return PurchaseOrder.find({
    isDeleted: false,
    $or: [{ purchaseRequisition: requisitionId }, { rfq: { $in: rfqIds } }]
  });
}

export async function cancelPurchaseOrderById(
  poId: mongoose.Types.ObjectId | string,
  user: { _id: unknown; role: string },
  reasonCode: string,
  reasonDetails?: string,
  options?: { skipAuth?: boolean; cascadeFromRequisition?: boolean }
): Promise<{ po: any; prUpdated: boolean }> {
  if (!isValidPoCancellationReason(reasonCode)) {
    throw new CancellationError('Invalid cancellation reason');
  }

  const po = await PurchaseOrder.findById(poId);
  if (!po || po.isDeleted) {
    throw new CancellationError('Purchase order not found', 404);
  }

  if (!options?.skipAuth) {
    assertCanCancelPurchaseOrder(user, po);
  }

  if (!(CANCELLABLE_PO_STATUSES as readonly string[]).includes(po.status)) {
    throw new CancellationError(`Purchase order cannot be cancelled while ${po.status.replace(/_/g, ' ')}`);
  }

  await assertPoHasNoBlockers(po._id);

  const reasonText = options?.cascadeFromRequisition
    ? formatPoReason('requisition_cancelled', reasonDetails)
    : formatPoReason(reasonCode, reasonDetails);

  po.status = 'cancelled';
  po.cancelledBy = user._id as mongoose.Types.ObjectId;
  po.cancelledAt = new Date();
  po.cancellationReason = reasonText;
  po.approvalHistory.push({
    action: 'cancelled',
    by: user._id,
    role: user.role,
    comments: reasonText
  });

  await po.save();

  let prUpdated = false;
  if (po.purchaseRequisition) {
    const activePos = await PurchaseOrder.countDocuments({
      purchaseRequisition: po.purchaseRequisition,
      isDeleted: false,
      status: { $nin: ['cancelled', 'rejected'] }
    });

    if (activePos === 0) {
      const pr = await PurchaseRequisition.findById(po.purchaseRequisition);
      if (pr && pr.status === 'ordered') {
        pr.status = 'quoted';
        pr.statusHistory.push({
          action: 'returned',
          by: user._id,
          role: user.role,
          comments: 'Reverted to quoted — all linked purchase orders were cancelled'
        });
        await pr.save();
        prUpdated = true;
      }
    }
  }

  return { po, prUpdated };
}

export async function cancelRequisitionById(
  requisitionId: mongoose.Types.ObjectId | string,
  user: { _id: unknown; role: string; department?: unknown },
  reasonCode: string,
  reasonDetails?: string
): Promise<{
  requisition: any;
  cancelledRfqs: number;
  cancelledPos: number;
  blockedPos: string[];
}> {
  if (!isValidPrCancellationReason(reasonCode)) {
    throw new CancellationError('Invalid cancellation reason');
  }

  if (reasonCode === 'other' && !reasonDetails?.trim()) {
    throw new CancellationError('Please provide details when selecting "Other"');
  }

  const requisition = await PurchaseRequisition.findById(requisitionId);
  if (!requisition || requisition.isDeleted) {
    throw new CancellationError('Requisition not found', 404);
  }

  assertCanCancelRequisition(user, requisition);

  const reasonText = formatReason(reasonCode, reasonDetails);
  const linkedPos = await findLinkedPurchaseOrders(requisition._id);

  const blockedPos: string[] = [];
  const cancellablePos = [];

  for (const po of linkedPos) {
    if ((PO_TERMINAL_STATUSES as readonly string[]).includes(po.status)) {
      blockedPos.push(`${po.poNumber} (${po.status})`);
      continue;
    }
    if (!(CANCELLABLE_PO_STATUSES as readonly string[]).includes(po.status)) {
      blockedPos.push(`${po.poNumber} (${po.status})`);
      continue;
    }
    try {
      await assertPoHasNoBlockers(po._id);
      cancellablePos.push(po);
    } catch {
      blockedPos.push(`${po.poNumber} (invoice or delivery exists)`);
    }
  }

  if (blockedPos.length > 0) {
    throw new CancellationError(
      `Cannot cancel requisition while active purchase orders exist: ${blockedPos.join(', ')}`
    );
  }

  let cancelledPos = 0;
  for (const po of cancellablePos) {
    await cancelPurchaseOrderById(
      po._id,
      user,
      'requisition_cancelled',
      reasonText,
      { skipAuth: true, cascadeFromRequisition: true }
    );
    cancelledPos += 1;
  }

  const rfqResult = await RFQ.updateMany(
    {
      purchaseRequisition: requisition._id,
      isDeleted: false,
      status: { $in: OPEN_RFQ_STATUSES }
    },
    {
      $set: {
        status: 'cancelled',
        notes: `Cancelled with requisition ${requisition.requisitionNumber}: ${reasonText}`
      }
    }
  );

  requisition.status = 'cancelled';
  requisition.cancelledBy = user._id as mongoose.Types.ObjectId;
  requisition.cancelledAt = new Date();
  requisition.cancellationReason = reasonText;
  requisition.statusHistory.push({
    action: 'cancelled',
    by: user._id,
    role: user.role,
    comments: reasonText
  });

  await requisition.save();

  return {
    requisition,
    cancelledRfqs: rfqResult.modifiedCount,
    cancelledPos,
    blockedPos
  };
}
