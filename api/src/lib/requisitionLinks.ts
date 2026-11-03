import { Delivery, PurchaseOrder, Quotation, StoreRequisition } from '../models/index.js';
import { escapeRegex } from './regex.js';

/** Delivery statuses that mean the goods are in stores. */
export const DELIVERED_TO_STORES = ['received', 'accepted', 'partially_accepted'];

/**
 * How a store requisition's purpose names the purchase requisition it collects
 * for: its number, or the short id for the few raised before numbering.
 */
export function requisitionRef(requisition: { _id: any; requisitionNumber?: string }): string {
  return requisition.requisitionNumber || `PR-${requisition._id.toString().slice(-6)}`;
}

/**
 * Which of these purchase requisitions have had their items collected, i.e.
 * an issued store requisition names them in its purpose.
 *
 * One query for the whole page, filtered to purposes that mention one of the
 * numbers, rather than loading every issued store requisition in the unit.
 * The final check stays a plain substring match, exactly as before.
 */
export async function collectedRequisitionRefs(
  refs: string[],
  scope: Record<string, unknown> = {}
): Promise<Set<string>> {
  const wanted = Array.from(new Set(refs.filter(Boolean)));
  if (wanted.length === 0) return new Set();

  const storeRequisitions = await StoreRequisition.find({
    ...scope,
    isDeleted: false,
    status: { $in: ['issued', 'partially_issued'] },
    purpose: { $regex: wanted.map(escapeRegex).join('|') }
  })
    .select('purpose')
    .lean();

  const purposes = storeRequisitions.map((sr: any) => sr.purpose).filter(Boolean) as string[];
  return new Set(wanted.filter((ref) => purposes.some((purpose) => purpose.includes(ref))));
}

// What the requisition page shows of its PO. The line items stay: the
// requisitions list reads them from here to raise a store requisition.
const DETAIL_PO_FIELDS =
  'poNumber status deptHodApproved procHodApproved financeApproved cooApproved purchaseRequisition rfq quotation supplier items totalAmount currency requiresCooApproval totalAmountUsd cooThresholdUsd';

export interface RequisitionOrderProgress {
  purchaseOrder: any;
  itemsDeliveredToStores: boolean;
  itemsCollected: boolean;
}

/**
 * The PO behind one requisition, and whether its goods are in stores and have
 * been collected, for GET /requisitions/:id.
 *
 * The PO is linked directly, or else through a quotation on the requisition's
 * RFQ. Both are looked up at once; the quotation route is used only when there
 * is no direct link and `rfqLinked` confirms the requisition's RFQ still
 * resolves, so the result matches looking them up one after the other.
 * `collectedScope` bounds the store requisitions consulted.
 */
export async function requisitionOrderProgress(
  requisition: { _id: any; requisitionNumber?: string },
  rfqId: any,
  rfqLinked: Promise<boolean>,
  collectedScope: Promise<Record<string, unknown>> | Record<string, unknown>
): Promise<RequisitionOrderProgress | null> {
  const [direct, quotations, hasRfq] = await Promise.all([
    PurchaseOrder.findOne({ purchaseRequisition: requisition._id, isDeleted: false })
      .select(DETAIL_PO_FIELDS)
      .lean(),
    rfqId
      ? Quotation.find({ rfq: rfqId, isDeleted: false }).select('_id').lean()
      : Promise.resolve([] as any[]),
    rfqLinked
  ]);

  let po: any = direct;
  if (!po && hasRfq && quotations.length > 0) {
    po = await PurchaseOrder.findOne({ quotation: { $in: quotations.map((q: any) => q._id) }, isDeleted: false })
      .select(DETAIL_PO_FIELDS)
      .lean();
  }
  if (!po) return null;

  const [, delivered, collected] = await Promise.all([
    PurchaseOrder.populate(po, { path: 'supplier', select: 'companyName', options: { lean: true } }),
    Delivery.exists({ purchaseOrder: po._id, status: { $in: DELIVERED_TO_STORES }, isDeleted: false }),
    Promise.resolve(collectedScope).then((scope) => collectedRequisitionRefs([requisitionRef(requisition)], scope))
  ]);

  return {
    purchaseOrder: po,
    itemsDeliveredToStores: Boolean(delivered),
    itemsCollected: collected.size > 0
  };
}
