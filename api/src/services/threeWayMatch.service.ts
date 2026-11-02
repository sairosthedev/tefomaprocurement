import type { IPurchaseOrder } from '../models/PurchaseOrder.model.js';
import type { IInvoiceItem, IThreeWayMatchResult, IMatchLineResult } from '../models/Invoice.model.js';
import { Delivery } from '../models/index.js';

const TOLERANCE_PERCENT = 0.02;
const TOLERANCE_ABSOLUTE = 1;

/** Delivery states that count as goods legitimately taken onto stock. */
const RECEIPTED_STATUSES = ['received', 'accepted', 'partially_accepted'];

function withinTolerance(expected: number, actual: number): boolean {
  const variance = Math.abs(actual - expected);
  const threshold = Math.max(TOLERANCE_ABSOLUTE, expected * TOLERANCE_PERCENT);
  return variance <= threshold;
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
  const deliveries = await Delivery.find({
    purchaseOrder: po._id,
    status: { $in: RECEIPTED_STATUSES },
    isDeleted: false
  }).lean();

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

export function performThreeWayMatch(
  po: IPurchaseOrder,
  invoiceItems: IInvoiceItem[],
  evidence?: GrvEvidence,
  invoiceVatAmount = 0
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

  if (evidence && !evidence.hasGrv) {
    messages.push('No goods received note (GRV) has been raised by stores for this purchase order');
  }

  po.items.forEach((poItem, index) => {
    // Without GRV evidence loaded, fall back to the PO counter so existing
    // callers keep working; the approval path always supplies evidence.
    const receivedQty = evidence
      ? evidence.quantityByPoIndex.get(index) || 0
      : poItem.quantityReceived || 0;
    const lineReceivedValue = receivedQty * poItem.unitPrice;
    receivedValue += lineReceivedValue;

    const invoiceLine =
      invoiceItems.find((i) => i.poItemIndex === index) ||
      invoiceItems.find(
        (i) => i.description.toLowerCase().trim() === poItem.description.toLowerCase().trim()
      );

    const invoicedQty = invoiceLine?.quantity ?? 0;
    const invoicedLineTotal = invoiceLine?.totalPrice ?? 0;
    const poLineTotal = poItem.totalPrice;
    const quantityVariance = invoicedQty - receivedQty;
    const amountVariance = invoicedLineTotal - lineReceivedValue;
    const lineMatched =
      receivedQty > 0 &&
      withinTolerance(lineReceivedValue, invoicedLineTotal) &&
      quantityVariance <= 0.001;

    if (receivedQty === 0 && invoicedQty > 0) {
      messages.push(`"${poItem.description}": invoiced but not receipted on any GRV`);
    } else if (invoicedQty > receivedQty) {
      messages.push(`"${poItem.description}": invoiced qty (${invoicedQty}) exceeds received (${receivedQty})`);
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
      matched: lineMatched
    });
  });

  // Invoice total compared here is VAT-exclusive (sum of line totals), matching
  // the VAT-exclusive po subtotal and received value.
  const invoicedTotal = invoiceItems.reduce((s, i) => s + i.totalPrice, 0);
  const varianceAmount = invoicedTotal - receivedValue;
  const totalMatched =
    withinTolerance(poNetTotal, invoicedTotal) &&
    withinTolerance(receivedValue, invoicedTotal) &&
    lines.every((l) => l.matched || l.invoicedLineTotal === 0);

  if (receivedValue === 0 && !(evidence && !evidence.hasGrv)) {
    messages.push('No goods have been received on this purchase order yet');
  }

  if (!withinTolerance(receivedValue, invoicedTotal)) {
    messages.push(
      `Invoice total (${invoicedTotal.toFixed(2)}) does not match received value (${receivedValue.toFixed(2)})`
    );
  }

  // A match requires a GRV to exist: without stores' receipt document there is
  // no independent evidence the goods arrived, whatever the PO says.
  const hasGrv = evidence ? evidence.hasGrv : receivedValue > 0;

  // VAT is reconciled separately: the invoiced VAT should agree with the PO VAT.
  const poVat = po.vatAmount ?? 0;
  if (!withinTolerance(poVat, invoiceVatAmount)) {
    messages.push(
      `Invoice VAT (${invoiceVatAmount.toFixed(2)}) does not match PO VAT (${poVat.toFixed(2)})`
    );
  }
  const vatMatched = withinTolerance(poVat, invoiceVatAmount);

  return {
    // Expose the VAT-inclusive PO total for display continuity with prior reports.
    poTotal: po.totalAmount,
    poNumber: po.poNumber,
    receivedValue,
    invoicedTotal,
    varianceAmount,
    matched: totalMatched && vatMatched && receivedValue > 0 && hasGrv,
    withinTolerance: withinTolerance(receivedValue, invoicedTotal) && vatMatched,
    grvNumbers: evidence?.grvNumbers ?? [],
    hasGrv,
    lines,
    messages,
    matchedAt: new Date()
  };
}
