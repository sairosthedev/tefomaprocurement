import type { IPurchaseOrder } from '../models/PurchaseOrder.model.js';
import type { IInvoiceItem, IThreeWayMatchResult, IMatchLineResult } from '../models/Invoice.model.js';

const TOLERANCE_PERCENT = 0.02;
const TOLERANCE_ABSOLUTE = 1;

function withinTolerance(expected: number, actual: number): boolean {
  const variance = Math.abs(actual - expected);
  const threshold = Math.max(TOLERANCE_ABSOLUTE, expected * TOLERANCE_PERCENT);
  return variance <= threshold;
}

export function performThreeWayMatch(
  po: IPurchaseOrder,
  invoiceItems: IInvoiceItem[],
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

  po.items.forEach((poItem, index) => {
    const receivedQty = poItem.quantityReceived || 0;
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
      messages.push(`"${poItem.description}": invoiced but nothing received on PO`);
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

  if (receivedValue === 0) {
    messages.push('No goods have been received on this purchase order yet');
  }

  if (!withinTolerance(receivedValue, invoicedTotal)) {
    messages.push(
      `Invoice total (${invoicedTotal.toFixed(2)}) does not match received value (${receivedValue.toFixed(2)})`
    );
  }

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
    matched: totalMatched && vatMatched && receivedValue > 0,
    withinTolerance: withinTolerance(receivedValue, invoicedTotal) && vatMatched,
    lines,
    messages,
    matchedAt: new Date()
  };
}
