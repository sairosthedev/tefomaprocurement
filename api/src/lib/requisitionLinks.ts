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

/** What an IR shows of a store requisition raised to collect its goods. */
export interface LinkedStoreRequisition {
  _id: any;
  requisitionNumber: string;
  status: string;
  issueNoteNumber?: string;
  issuedAt?: Date;
  createdAt: Date;
  /** Units it asks stores for, across its lines. */
  unitsRequested: number;
}

/** Store requisition statuses that mean the goods have left stores. */
const COLLECTED_STATUSES = ['issued', 'partially_issued'];
/** Rejected and cancelled store requisitions no longer stand for the IR. */
const LIVE_STATUSES = ['draft', 'pending', 'approved', 'partially_issued', 'issued'];

/**
 * The store requisitions raised to collect each of these IRs' goods, newest
 * first, keyed by IR id.
 *
 * Linked ones carry the IR's id. Those raised before the link existed only
 * name the IR in their purpose, so they are still matched on the number. One
 * query for the whole page.
 */
export async function storeRequisitionsByRequisition(
  requisitions: Array<{ _id: any; requisitionNumber?: string }>,
  scope: Record<string, unknown> = {}
): Promise<Map<string, LinkedStoreRequisition[]>> {
  const byRequisition = new Map<string, LinkedStoreRequisition[]>();
  if (requisitions.length === 0) return byRequisition;

  const idByRef = new Map(requisitions.map((r) => [requisitionRef(r), r._id.toString()]));
  const storeRequisitions = await StoreRequisition.find({
    ...scope,
    isDeleted: false,
    $or: [
      { purchaseRequisition: { $in: requisitions.map((r) => r._id) } },
      {
        purchaseRequisition: null,
        purpose: { $regex: Array.from(idByRef.keys()).map(escapeRegex).join('|') }
      }
    ]
  })
    .select('requisitionNumber status purchaseRequisition purpose issueNoteNumber issuedAt createdAt items.quantityRequested')
    .sort({ createdAt: -1 })
    .lean();

  for (const sr of storeRequisitions as any[]) {
    const { purpose, purchaseRequisition, items, ...rest } = sr;
    const linked: LinkedStoreRequisition = {
      ...rest,
      unitsRequested: (items || []).reduce((sum: number, line: any) => sum + (line.quantityRequested || 0), 0)
    };
    const ids = purchaseRequisition
      ? [purchaseRequisition.toString()]
      : Array.from(idByRef)
          .filter(([ref]) => purpose?.includes(ref))
          .map(([, id]) => id);
    for (const id of ids) {
      if (!byRequisition.has(id)) byRequisition.set(id, []);
      byRequisition.get(id)!.push(linked);
    }
  }
  return byRequisition;
}

/** Units received on an order so far, across its lines. */
export function unitsReceivedOn(po: { items?: Array<{ quantityReceived?: number }> } | null | undefined): number {
  return (po?.items || []).reduce((sum, line) => sum + (line.quantityReceived || 0), 0);
}

/**
 * Whether an IR's goods have been collected, and the store requisition that
 * stands for it.
 *
 * Collected means some have left stores and every unit received so far has
 * been asked for. Without the second part, goods from a later delivery on the
 * same order could never be requested: the first collection hid the button.
 * `unitsReceived` is left out where the order's lines are not to hand.
 */
export function collectionState(linked: LinkedStoreRequisition[] = [], unitsReceived?: number): {
  itemsCollected: boolean;
  storeRequisition: LinkedStoreRequisition | null;
} {
  const live = linked.filter((sr) => LIVE_STATUSES.includes(sr.status));
  const unitsAskedFor = live.reduce((sum, sr) => sum + (sr.unitsRequested || 0), 0);
  return {
    itemsCollected:
      linked.some((sr) => COLLECTED_STATUSES.includes(sr.status)) &&
      (unitsReceived === undefined || unitsAskedFor >= unitsReceived),
    storeRequisition: live[0] || null
  };
}

// What the requisition page shows of its PO. The line items stay: the
// requisitions list reads them from here to raise a store requisition.
const DETAIL_PO_FIELDS =
  'poNumber status deptHodApproved procHodApproved financeApproved cooApproved purchaseRequisition rfq quotation supplier items totalAmount currency requiresCooApproval totalAmountUsd cooThresholdUsd';

export interface RequisitionOrderProgress {
  purchaseOrder: any;
  itemsDeliveredToStores: boolean;
  itemsCollected: boolean;
  /** Store requisitions raised to collect the goods, newest first. */
  storeRequisitions: LinkedStoreRequisition[];
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

  const [, delivered, linked] = await Promise.all([
    PurchaseOrder.populate(po, { path: 'supplier', select: 'companyName', options: { lean: true } }),
    Delivery.exists({ purchaseOrder: po._id, status: { $in: DELIVERED_TO_STORES }, isDeleted: false }),
    Promise.resolve(collectedScope).then((scope) => storeRequisitionsByRequisition([requisition], scope))
  ]);
  const storeRequisitions = linked.get(requisition._id.toString()) || [];

  return {
    purchaseOrder: po,
    itemsDeliveredToStores: Boolean(delivered),
    itemsCollected: collectionState(storeRequisitions, unitsReceivedOn(po)).itemsCollected,
    storeRequisitions
  };
}
