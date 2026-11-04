import type { IPurchaseOrder } from '../models/PurchaseOrder.model.js';
import type { IInvoiceItem, IThreeWayMatchResult, IMatchLineResult } from '../models/Invoice.model.js';
import { Delivery, Invoice } from '../models/index.js';

const TOLERANCE_PERCENT = 0.02;
const TOLERANCE_ABSOLUTE = 1;

/** Delivery states that count as goods legitimately taken onto stock. */
const RECEIPTED_STATUSES = ['received', 'accepted', 'partially_accepted'];

/**
 * Invoice states that no longer bill anything on the PO: rejected and
 * cancelled invoices will not be paid, and a draft was never submitted. Any
 * other invoice has claimed goods that a later invoice cannot claim again.
 */
const NOT_BILLING_STATUSES = ['rejected', 'cancelled', 'draft'];

/** Invoice states finance has already committed to paying. */
export const APPROVED_INVOICE_STATUSES = ['approved', 'partially_paid', 'paid'];

function toleranceFor(expected: number): number {
  return Math.max(TOLERANCE_ABSOLUTE, expected * TOLERANCE_PERCENT);
}

function withinTolerance(expected: number, actual: number): boolean {
  const variance = Math.abs(actual - expected);
  return variance <= toleranceFor(expected);
}

/** One-sided check: `actual` is over `limit` by more than the rounding tolerance. */
export function exceedsTolerance(limit: number, actual: number): boolean {
  return actual - limit > toleranceFor(limit);
}

/** The invoice line billing a PO line: by its PO line index, else by description. */
function invoiceLineFor(items: IInvoiceItem[], poItem: { description: string }, index: number) {
  return (
    items.find((i) => i.poItemIndex === index) ||
    items.find(
      (i) => i.description?.toLowerCase().trim() === poItem.description?.toLowerCase().trim()
    )
  );
}

export interface GrvEvidence {
  /** GRV numbers backing the received quantities, for the audit trail. */
  grvNumbers: string[];
  /** Received quantity per PO line index, summed across every GRV. */
  quantityByPoIndex: Map<number, number>;
  hasGrv: boolean;
}

/**
 * Receipt evidence for a PO, read from the GRV (Delivery) documents stores
 * raised rather than the `quantityReceived` counter denormalised onto the PO.
 * The GRV is the independent record of what physically arrived; matching
 * against it is what makes the three-way match a control rather than a
 * restatement of the PO.
 *
 * Quantities are net of rejections — goods booked in and then rejected on
 * inspection are not payable.
 */
export async function collectGrvEvidence(po: IPurchaseOrder): Promise<GrvEvidence> {
  return grvEvidenceFrom(po, await findReceiptedDeliveries(po._id));
}

/** The GRVs raised against a PO. Needs only the PO id, so a caller holding
 *  just the id can read them alongside the PO itself. */
export function findReceiptedDeliveries(purchaseOrderId: any) {
  return Delivery.find({
    purchaseOrder: purchaseOrderId,
    status: { $in: RECEIPTED_STATUSES },
    isDeleted: false
  }).lean();
}

/** collectGrvEvidence for GRVs already read by findReceiptedDeliveries. */
export function grvEvidenceFrom(
  po: IPurchaseOrder,
  deliveries: Awaited<ReturnType<typeof findReceiptedDeliveries>>
): GrvEvidence {
  const quantityByPoIndex = new Map<number, number>();
  const grvNumbers: string[] = [];

  for (const delivery of deliveries) {
    if (delivery.grvNumber) grvNumbers.push(delivery.grvNumber);

    for (const line of delivery.items || []) {
      // Prefer the explicit PO line link; fall back to description match for
      // GRVs raised before the link was captured.
      let index = po.items.findIndex(
        (poItem: any) => line.poItem && poItem._id?.toString() === line.poItem.toString()
      );
      if (index === -1 && line.description) {
        index = po.items.findIndex(
          (poItem: any) =>
            poItem.description?.toLowerCase().trim() === line.description!.toLowerCase().trim()
        );
      }
      if (index === -1) continue;

      const net = Math.max(0, (line.quantityReceived || 0) - (line.quantityRejected || 0));
      quantityByPoIndex.set(index, (quantityByPoIndex.get(index) || 0) + net);
    }
  }

  return { grvNumbers, quantityByPoIndex, hasGrv: deliveries.length > 0 };
}

/** What the other invoices on a PO have already billed. */
export interface PriorBilling {
  invoiceNumbers: string[];
  /** Quantity already invoiced per PO line index. */
  quantityByPoIndex: Map<number, number>;
  /** VAT-exclusive total of those invoices. */
  total: number;
  /** VAT-exclusive total of the ones finance has already approved or paid. */
  approvedTotal: number;
}

/**
 * The other live invoices on a PO. Without this every invoice was matched
 * against the whole received value, so a second invoice for goods already
 * billed matched as cleanly as the first. `excludeInvoiceId` leaves out the
 * invoice being matched itself.
 */
export async function collectPriorBilling(
  po: IPurchaseOrder,
  excludeInvoiceId?: unknown
): Promise<PriorBilling> {
  const query: Record<string, unknown> = {
    purchaseOrder: po._id,
    isDeleted: false,
    status: { $nin: NOT_BILLING_STATUSES }
  };
  if (excludeInvoiceId) query._id = { $ne: excludeInvoiceId };
  const invoices = await Invoice.find(query).select('invoiceNumber items status').lean();
  return priorBillingFrom(po, invoices);
}

/** collectPriorBilling for invoices already read. */
export function priorBillingFrom(
  po: IPurchaseOrder,
  invoices: Array<{ invoiceNumber?: string; status?: string; items?: IInvoiceItem[] }>
): PriorBilling {
  const quantityByPoIndex = new Map<number, number>();
  const invoiceNumbers: string[] = [];
  let total = 0;
  let approvedTotal = 0;

  for (const invoice of invoices) {
    const items = invoice.items || [];
    if (invoice.invoiceNumber) invoiceNumbers.push(invoice.invoiceNumber);
    const value = items.reduce((s, i) => s + (i.totalPrice || 0), 0);
    total += value;
    if (APPROVED_INVOICE_STATUSES.includes(invoice.status || '')) approvedTotal += value;

    // Lines are attributed to PO lines the same way the match reads them.
    po.items.forEach((poItem, index) => {
      const line = invoiceLineFor(items, poItem, index);
      if (line) quantityByPoIndex.set(index, (quantityByPoIndex.get(index) || 0) + (line.quantity || 0));
    });
  }

  return { invoiceNumbers, quantityByPoIndex, total, approvedTotal };
}

export function performThreeWayMatch(
  po: IPurchaseOrder,
  invoiceItems: IInvoiceItem[],
  evidence?: GrvEvidence,
  invoiceVatAmount = 0,
  prior?: PriorBilling
): IThreeWayMatchResult {
  const messages: string[] = [];
  const lines: IMatchLineResult[] = [];

  // Line totals on both the PO and the invoice are VAT-exclusive, so the
  // line-level and net-of-VAT comparisons below must use the PO subtotal, not
  // totalAmount (which includes VAT). Comparing a VAT-exclusive invoice total
  // against a VAT-inclusive PO total would flag every VAT-bearing PO as a
  // variance even when the invoice is correct.
  const poNetTotal = po.subtotal ?? po.totalAmount;
  let receivedValue = 0;
  // The PO at unit prices, on the same basis as receivedValue, for pro-rating VAT.
  let orderedValue = 0;

  // Only invoices that exist count; an empty lookup behaves as no lookup.
  const billedBefore = prior && prior.invoiceNumbers.length > 0 ? prior : undefined;
  const priorTotal = billedBefore?.total ?? 0;

  if (evidence && !evidence.hasGrv) {
    messages.push('No goods received note (GRV) has been raised by stores for this purchase order');
  }
  if (billedBefore) {
    messages.push(
      `Already invoiced on this purchase order: ${billedBefore.invoiceNumbers.join(', ')} (${priorTotal.toFixed(2)} excl. VAT)`
    );
  }

  po.items.forEach((poItem, index) => {
    // Without GRV evidence loaded, fall back to the PO counter so existing
    // callers keep working; the approval path always supplies evidence.
    const receivedQty = evidence
      ? evidence.quantityByPoIndex.get(index) || 0
      : poItem.quantityReceived || 0;
    const lineReceivedValue = receivedQty * poItem.unitPrice;
    receivedValue += lineReceivedValue;
    orderedValue += (poItem.quantity || 0) * poItem.unitPrice;

    // Goods an earlier invoice on this PO billed cannot be billed again, so
    // the line is held to what was received and is not yet invoiced.
    const alreadyInvoicedQty = billedBefore?.quantityByPoIndex.get(index) || 0;
    const billableQty = Math.max(0, receivedQty - alreadyInvoicedQty);
    const billableValue = billableQty * poItem.unitPrice;

    const invoiceLine = invoiceLineFor(invoiceItems, poItem, index);

    const invoicedQty = invoiceLine?.quantity ?? 0;
    const invoicedLineTotal = invoiceLine?.totalPrice ?? 0;
    const poLineTotal = poItem.totalPrice;
    const quantityVariance = invoicedQty - billableQty;
    const amountVariance = invoicedLineTotal - billableValue;
    const lineMatched =
      billableQty > 0 &&
      withinTolerance(billableValue, invoicedLineTotal) &&
      quantityVariance <= 0.001;

    if (receivedQty === 0 && invoicedQty > 0) {
      messages.push(`"${poItem.description}": invoiced but not receipted on any GRV`);
    } else if (invoicedQty > billableQty) {
      messages.push(
        alreadyInvoicedQty > 0
          ? `"${poItem.description}": invoiced qty (${invoicedQty}) exceeds received qty not yet invoiced (${billableQty}: ${receivedQty} received, ${alreadyInvoicedQty} already invoiced)`
          : `"${poItem.description}": invoiced qty (${invoicedQty}) exceeds received (${receivedQty})`
      );
    } else if (!lineMatched && invoicedLineTotal > 0) {
      messages.push(`"${poItem.description}": amount variance ${amountVariance.toFixed(2)}`);
    }

    lines.push({
      description: poItem.description,
      poQuantity: poItem.quantity,
      receivedQuantity: receivedQty,
      invoicedQuantity: invoicedQty,
      poLineTotal,
      receivedValue: lineReceivedValue,
      invoicedLineTotal,
      quantityVariance,
      amountVariance,
      matched: lineMatched,
      ...(alreadyInvoicedQty > 0 ? { previouslyInvoicedQuantity: alreadyInvoicedQty } : {})
    });
  });

  // Invoice total compared here is VAT-exclusive (sum of line totals), matching
  // the VAT-exclusive po subtotal and received value.
  const invoicedTotal = invoiceItems.reduce((s, i) => s + i.totalPrice, 0);
  // What this invoice may bill: the received value less what other invoices
  // on the PO already billed.
  const billableValue = Math.max(0, receivedValue - priorTotal);
  const varianceAmount = invoicedTotal - billableValue;
  const withinReceived = withinTolerance(billableValue, invoicedTotal);
  // The PO bounds the invoice from above only: a partial delivery is rightly
  // billed below the PO total, and is held to what was received instead.
  const poRemaining = Math.max(0, poNetTotal - priorTotal);
  const withinPo = !exceedsTolerance(poRemaining, invoicedTotal);
  const totalMatched =
    withinPo &&
    withinReceived &&
    lines.every((l) => l.matched || l.invoicedLineTotal === 0);

  if (receivedValue === 0 && !(evidence && !evidence.hasGrv)) {
    messages.push('No goods have been received on this purchase order yet');
  }

  if (!withinReceived) {
    messages.push(
      billedBefore
        ? `Invoice total (${invoicedTotal.toFixed(2)}) does not match the received value not yet invoiced (${billableValue.toFixed(2)}: ${receivedValue.toFixed(2)} received, ${priorTotal.toFixed(2)} already invoiced)`
        : `Invoice total (${invoicedTotal.toFixed(2)}) does not match received value (${receivedValue.toFixed(2)})`
    );
  } else if (!withinPo) {
    messages.push(
      `Invoice total (${invoicedTotal.toFixed(2)}) exceeds the purchase order value not yet invoiced (${poRemaining.toFixed(2)})`
    );
  }

  // A match requires a GRV to exist: without stores' receipt document there is
  // no independent evidence the goods arrived, whatever the PO says.
  const hasGrv = evidence ? evidence.hasGrv : receivedValue > 0;

  // VAT is reconciled separately: the invoiced VAT should agree with the PO
  // VAT on the share of the order this invoice may bill, so a partial delivery
  // or a second invoice is not held to the whole order's VAT. Never more than
  // the PO VAT; a fully received, singly invoiced PO is held to all of it.
  const poVat = po.vatAmount ?? 0;
  const vatBase = orderedValue > 0 ? orderedValue : poNetTotal;
  const share = vatBase > 0 ? Math.min(1, billableValue / vatBase) : 1;
  const expectedVat = share >= 1 - 1e-9 ? poVat : poVat * share;
  const vatMatched = withinTolerance(expectedVat, invoiceVatAmount);
  if (!vatMatched) {
    messages.push(
      expectedVat === poVat
        ? `Invoice VAT (${invoiceVatAmount.toFixed(2)}) does not match PO VAT (${poVat.toFixed(2)})`
        : `Invoice VAT (${invoiceVatAmount.toFixed(2)}) does not match the VAT due on the received value not yet invoiced (${expectedVat.toFixed(2)} of PO VAT ${poVat.toFixed(2)})`
    );
  }

  return {
    // Expose the VAT-inclusive PO total for display continuity with prior reports.
    poTotal: po.totalAmount,
    poNumber: po.poNumber,
    receivedValue,
    invoicedTotal,
    varianceAmount,
    matched: totalMatched && vatMatched && receivedValue > 0 && hasGrv,
    withinTolerance: withinReceived && vatMatched,
    grvNumbers: evidence?.grvNumbers ?? [],
    hasGrv,
    lines,
    messages,
    matchedAt: new Date(),
    ...(billedBefore
      ? { previouslyInvoiced: priorTotal, previousInvoiceNumbers: billedBefore.invoiceNumbers }
      : {})
  };
}
