/**
 * Form validators for purchase orders and invoices: creating a purchase order from an accepted
 * quotation, the supplier acknowledging it, submitting an invoice, and approving
 * or rejecting one.
 *
 * Built from the helpers in rules.ts; see that file for the conventions.
 */
import {
  FormErrors,
  TEXT_LIMITS,
  date,
  isBlank,
  lineField,
  maxLength,
  notBefore,
  notFuture,
  notPast,
  number,
  objectId,
  quantity,
  reason,
  required,
  type FieldErrors
} from './rules.js';

/** Longest supplier reference accepted: their invoice number or delivery note number. */
const REFERENCE_MAX = 50;

/**
 * Zero or more, without the two-decimal limit of `money`. For amounts the
 * system works out rather than someone typing them: a quotation's VAT is 15%
 * of its subtotal, unrounded, and a line total is quantity times unit price,
 * so the purchase order and the invoice drawn from it carry such figures.
 */
function amount(value: unknown, label: string): string {
  return number(value, { label, min: 0 });
}

export interface PurchaseOrderInput {
  quotationId?: unknown;
  deliverToSiteId?: unknown;
  deliveryAddress?: unknown;
  expectedDeliveryDate?: unknown;
  termsAndConditions?: unknown;
  notes?: unknown;
  /** The quotation's lines, which the order copies. Checked only when given. */
  items?: unknown;
}

/**
 * Create a purchase order from an accepted quotation: the purchase order form,
 * the quotations list's "Create Purchase Order", and the API behind both.
 * Lines are not typed in; they are the quotation's, passed as `items` once it
 * is loaded, and keyed `items.0.quantity` like any other list.
 */
export function validatePurchaseOrder(input: PurchaseOrderInput): FieldErrors {
  const v = new FormErrors();
  v.add(
    'quotationId',
    required(input.quotationId, 'Choose the quotation to order'),
    objectId(input.quotationId, 'Choose the quotation to order')
  );
  v.add('deliverToSiteId', objectId(input.deliverToSiteId, 'Choose the site to deliver to'));

  const address = input.deliveryAddress;
  if (address !== undefined && address !== null && (typeof address !== 'object' || Array.isArray(address))) {
    v.add('deliveryAddress', 'Enter the delivery address as street, city, province and postal code');
  } else {
    const parts = (address || {}) as Record<string, unknown>;
    v.add('deliveryAddress.street', maxLength(parts.street, TEXT_LIMITS.short, 'Street'));
    v.add('deliveryAddress.city', maxLength(parts.city, 80, 'City'));
    v.add('deliveryAddress.province', maxLength(parts.province, 80, 'Province'));
    v.add('deliveryAddress.postalCode', maxLength(parts.postalCode, 20, 'Postal code'));
  }

  v.add(
    'expectedDeliveryDate',
    required(input.expectedDeliveryDate, 'Choose the expected delivery date'),
    date(input.expectedDeliveryDate, 'Expected delivery date'),
    notPast(input.expectedDeliveryDate, 'Expected delivery date')
  );
  v.add('termsAndConditions', maxLength(input.termsAndConditions, TEXT_LIMITS.long, 'Terms and conditions'));
  v.add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Notes'));

  const items = input.items;
  if (items !== undefined && items !== null) {
    if (!Array.isArray(items) || items.length === 0) {
      v.add('items', 'This quotation has no lines to order');
    } else {
      items.forEach((item: any, index: number) => {
        v.add(lineField('items', index, 'description'), required(item?.description, 'The line has no description'));
        v.add(
          lineField('items', index, 'quantity'),
          required(item?.quantity, 'The line has no quantity'),
          quantity(item?.quantity)
        );
        v.add(
          lineField('items', index, 'unitPrice'),
          required(item?.unitPrice, 'The line has no unit price'),
          amount(item?.unitPrice, 'Unit price')
        );
      });
    }
  }
  return v.errors;
}

/** The supplier acknowledging a purchase order. Both fields are optional. */
export function validatePurchaseOrderAcknowledgement(input: {
  deliveryNoteNumber?: unknown;
  expectedDeliveryDate?: unknown;
}): FieldErrors {
  const v = new FormErrors();
  v.add('deliveryNoteNumber', maxLength(input.deliveryNoteNumber, REFERENCE_MAX, 'Delivery note number'));
  v.add('expectedDeliveryDate', notPast(input.expectedDeliveryDate, 'Expected delivery date'));
  return v.errors;
}

export interface InvoiceInput {
  purchaseOrderId?: unknown;
  vendorInvoiceNumber?: unknown;
  invoiceDate?: unknown;
  dueDate?: unknown;
  items?: unknown;
  vatAmount?: unknown;
  notes?: unknown;
}

/** A supplier's invoice against one of their purchase orders. */
export function validateInvoice(input: InvoiceInput, now: Date = new Date()): FieldErrors {
  const v = new FormErrors();
  v.add(
    'purchaseOrderId',
    required(input.purchaseOrderId, 'Choose the purchase order you are billing'),
    objectId(input.purchaseOrderId, 'Choose the purchase order you are billing')
  );
  v.add('vendorInvoiceNumber', maxLength(input.vendorInvoiceNumber, REFERENCE_MAX, 'Invoice number'));
  v.add(
    'invoiceDate',
    required(input.invoiceDate, 'Enter the invoice date'),
    notFuture(input.invoiceDate, 'Invoice date', now)
  );
  v.add(
    'dueDate',
    date(input.dueDate, 'Due date'),
    notBefore(input.dueDate, input.invoiceDate, 'Due date cannot be before the invoice date')
  );

  const items = input.items;
  if (!Array.isArray(items) || items.length === 0) {
    v.add('items', 'Add at least one line to bill');
  } else {
    items.forEach((item: any, index: number) => {
      v.add(
        lineField('items', index, 'description'),
        required(item?.description, 'Enter a description for the line'),
        maxLength(item?.description, TEXT_LIMITS.long, 'Description')
      );
      v.add(
        lineField('items', index, 'quantity'),
        required(item?.quantity, 'Enter the quantity'),
        quantity(item?.quantity)
      );
      v.add(
        lineField('items', index, 'unitPrice'),
        required(item?.unitPrice, 'Enter the unit price'),
        amount(item?.unitPrice, 'Unit price')
      );
      v.add(lineField('items', index, 'totalPrice'), amount(item?.totalPrice, 'Line total'));
      v.add(
        lineField('items', index, 'poItemIndex'),
        number(item?.poItemIndex, { label: 'Purchase order line', min: 0, integer: true })
      );
    });
  }

  v.add('vatAmount', amount(input.vatAmount, 'VAT'));
  v.add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Notes'));
  return v.errors;
}

/**
 * Finance approving an invoice. Approving despite a variance needs a written
 * reason, sent as `forceApprove`. The screen asks for one with
 * `override: true`. The API cannot tell from the request alone whether there
 * is a variance, so it checks a reason only when one is sent, and the
 * three-way match goes on refusing an override without one.
 */
export function validateInvoiceApproval(
  input: { forceApprove?: unknown; comments?: unknown },
  { override = false }: { override?: boolean } = {}
): FieldErrors {
  const v = new FormErrors();
  const sent = typeof input.forceApprove === 'string' && !isBlank(input.forceApprove);
  if (override || sent) {
    v.add('forceApprove', reason(input.forceApprove, 'Give a reason for approving despite the variance'));
  }
  v.add('comments', maxLength(input.comments, TEXT_LIMITS.long, 'Comments'));
  return v.errors;
}

/** Finance rejecting an invoice. */
export function validateInvoiceRejection(input: { reason?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('reason', reason(input.reason, 'Give a reason for rejecting this invoice'));
  return v.errors;
}
