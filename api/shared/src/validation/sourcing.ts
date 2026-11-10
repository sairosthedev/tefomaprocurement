/**
 * Form validators for sourcing: requests for quotation, quotations, accepting,
 * rejecting and revising them, line waivers and awards.
 *
 * Built from the helpers in rules.ts; see that file for the conventions.
 */
import { SUPPORTED_CURRENCY_CODES } from '../constants/currencies.js';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_LINE
} from '../constants/equipmentDetails.js';
import {
  FormErrors,
  TEXT_LIMITS,
  isBlank,
  lineField,
  maxLength,
  notBefore,
  notPast,
  number,
  objectId,
  oneOf,
  quantity,
  reason,
  required,
  text,
  type FieldErrors
} from './rules.js';

/** Longest RFQ title: room for "RFQ for " in front of the requisition's own title. */
export const RFQ_TITLE_MAX_LENGTH = 250;
/** Longest RFQ terms and conditions, which run to several paragraphs. */
export const RFQ_TERMS_MAX_LENGTH = 5000;

/** Reasons for waiving the three-quotation rule, as the RFQ record stores them. */
const WAIVER_TYPES: readonly string[] = [
  'service_agreement', 'single_source', 'approved_contract', 'no_quotes',
  'unique_product', 'coo_directed', 'custom_manufacture', 'coo_instruction', 'other'
];

/** A closing date and time that has not passed yet. */
function notPastMoment(value: unknown, label: string, now: Date): string {
  if (isBlank(value)) return '';
  const when = value instanceof Date ? value : typeof value === 'number' ? new Date(value) : new Date(text(value));
  if (Number.isNaN(when.getTime())) return `${label} is not a valid date`;
  return when.getTime() <= now.getTime() ? `${label} must be later than now` : '';
}

/** A term counted in whole days, at least one. */
function days(value: unknown, label: string): string {
  return number(value, { label, integer: true, min: 1 });
}

/** The value as a list, [] when nothing was sent, null when it is not a list. */
function list(value: unknown): unknown[] | null {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

// ─── Request for quotation ────────────────────────────────────────────────

export interface RfqLineInput {
  description?: unknown;
  quantity?: unknown;
  unit?: unknown;
}

export interface RfqInput {
  title?: unknown;
  description?: unknown;
  purchaseRequisitionId?: unknown;
  items?: unknown;
  /** The suppliers invited; the API also takes them as `supplierIds`. */
  invitedSuppliers?: unknown;
  supplierIds?: unknown;
  submissionDeadline?: unknown;
  deliveryRequiredBy?: unknown;
  termsAndConditions?: unknown;
  notes?: unknown;
  /** 'open' publishes it; anything else saves a draft. */
  status?: unknown;
}

export interface RfqValidationOptions {
  /**
   * The screen names suppliers before publishing. The API, given a
   * requisition and no suppliers, proposes them from its categories instead,
   * so there suppliers are needed only when there is no requisition.
   */
  requireSuppliers?: boolean;
  now?: Date;
}

/** Create a request for quotation, as a draft or published to suppliers. */
export function validateRfq(
  input: RfqInput,
  { requireSuppliers = false, now = new Date() }: RfqValidationOptions = {}
): FieldErrors {
  const v = new FormErrors();
  const publishing = input.status === 'open';

  v.add('title', required(input.title, 'Enter a title for the RFQ'), maxLength(input.title, RFQ_TITLE_MAX_LENGTH, 'Title'));
  v.add('description', maxLength(input.description, TEXT_LIMITS.long, 'Description'));
  // The RFQ record cannot be stored without a deadline, draft or not.
  v.add(
    'submissionDeadline',
    required(input.submissionDeadline, 'Set the submission deadline'),
    notPastMoment(input.submissionDeadline, 'Submission deadline', now)
  );
  v.add(
    'deliveryRequiredBy',
    notPast(input.deliveryRequiredBy, 'Delivery date', now),
    notBefore(input.deliveryRequiredBy, input.submissionDeadline, 'Delivery date cannot be before the submission deadline')
  );
  v.add('termsAndConditions', maxLength(input.termsAndConditions, RFQ_TERMS_MAX_LENGTH, 'Terms and conditions'));
  v.add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Notes'));
  v.add('purchaseRequisitionId', objectId(input.purchaseRequisitionId, 'Choose a requisition from the list'));

  const items = list(input.items);
  if (items === null) {
    v.add('items', 'Send the items as a list');
  } else {
    const entered = items.some((item) => !isBlank(record(item).description));
    if (publishing && !entered) v.add('items', 'Add at least one item before sending the RFQ to suppliers');
    items.forEach((raw, index) => {
      const line = record(raw);
      v.add(lineField('items', index, 'description'), required(line.description, 'Enter the item description'));
      v.add(
        lineField('items', index, 'quantity'),
        required(line.quantity, 'Enter the quantity'),
        quantity(line.quantity),
        number(line.quantity, { label: 'Quantity', min: 1 })
      );
      v.add(lineField('items', index, 'unit'), required(line.unit, 'Enter the unit'));
    });
  }

  // As the API reads them: supplierIds first, then invitedSuppliers.
  const suppliers = list(input.supplierIds || input.invitedSuppliers);
  if (suppliers === null) {
    v.add('invitedSuppliers', 'Choose suppliers from the list');
  } else {
    const needed = requireSuppliers || isBlank(input.purchaseRequisitionId);
    const ids = suppliers.map(text);
    v.add(
      'invitedSuppliers',
      needed && suppliers.length === 0 ? 'Choose at least one supplier to invite' : '',
      ids.some((id) => !id || objectId(id, 'bad')) ? 'Choose suppliers from the list' : '',
      new Set(ids).size !== ids.length ? 'Each supplier can be invited only once' : ''
    );
  }

  return v.errors;
}

// ─── Quotation (supplier) ─────────────────────────────────────────────────

export interface QuoteLinePhoto {
  fileName?: unknown;
  fileData?: unknown;
  mimeType?: unknown;
  /** Size in bytes, when the file has not been read yet. Otherwise worked out from fileData. */
  bytes?: number;
}

/** Decoded size of a data URI or base64 payload, as the API measures it. */
function photoBytes(photo: QuoteLinePhoto): number {
  if (typeof photo.bytes === 'number') return photo.bytes;
  const data = text(photo.fileData);
  const payload = data.includes(',') ? data.split(',')[1] : data;
  return Math.floor((payload?.length || 0) * 0.75);
}

const MAX_PHOTO_MB = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));

/** One photo of an offered part: its type and size. The photo picker checks each file with this before reading it. */
export function validateQuoteLinePhoto(photo: QuoteLinePhoto | null | undefined): string {
  if (!photo || typeof photo !== 'object') return 'Attach the photo again';
  if (photo.bytes === undefined && (isBlank(photo.fileName) || isBlank(photo.fileData))) {
    return 'Attach the photo again';
  }
  const name = text(photo.fileName) || 'The photo';
  if (!isBlank(photo.mimeType) && !ALLOWED_ATTACHMENT_MIME_TYPES.includes(text(photo.mimeType))) {
    return `${name} is not a supported file. Use a JPEG, PNG, WebP, HEIC or PDF`;
  }
  return photoBytes(photo) > MAX_ATTACHMENT_BYTES ? `${name} is larger than ${MAX_PHOTO_MB}MB` : '';
}

/** The photos on one quote line: how many, and each one's type and size. */
export function validateQuoteLinePhotos(photos: unknown): string {
  const all = list(photos);
  if (all === null) return 'Attach the photos again';
  if (all.length > MAX_ATTACHMENTS_PER_LINE) return `Attach at most ${MAX_ATTACHMENTS_PER_LINE} photos to a line`;
  for (const photo of all) {
    const problem = validateQuoteLinePhoto(photo as QuoteLinePhoto);
    if (problem) return problem;
  }
  return '';
}

export interface QuotationLineInput {
  rfqLineId?: unknown;
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  brand?: unknown;
  notes?: unknown;
  alternativeDescription?: unknown;
  alternativePartNumber?: unknown;
  attachments?: unknown;
}

export interface QuotationInput {
  rfqId?: unknown;
  currency?: unknown;
  deliveryPeriod?: unknown;
  validityPeriod?: unknown;
  paymentTerms?: unknown;
  notes?: unknown;
  items?: unknown;
}

/** A supplier submits a quotation for an RFQ, or a revised one when asked. */
export function validateQuotation(input: QuotationInput): FieldErrors {
  const v = new FormErrors();
  v.add('rfqId', required(input.rfqId, 'Choose the RFQ you are quoting for'), objectId(input.rfqId, 'Choose the RFQ you are quoting for'));
  v.add('currency', oneOf(input.currency, SUPPORTED_CURRENCY_CODES, 'Choose a currency from the list'));
  v.add('deliveryPeriod', required(input.deliveryPeriod, 'Enter the delivery time in days'), days(input.deliveryPeriod, 'Delivery days'));
  // Left out, the quotation is valid for 30 days.
  v.add('validityPeriod', days(input.validityPeriod, 'Days valid'));
  v.add('paymentTerms', required(input.paymentTerms, 'Choose the payment terms'), maxLength(input.paymentTerms, TEXT_LIMITS.name, 'Payment terms'));
  v.add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Notes'));

  // A quote may price some of the RFQ's lines, but not none of them, and
  // every line it sends needs a price.
  const items = list(input.items);
  if (items === null || items.length === 0) {
    v.add('items', 'Price at least one item');
    return v.errors;
  }
  const quoted = new Set<string>();
  items.forEach((raw, index) => {
    const line = record(raw) as QuotationLineInput;
    const field = (name: string) => lineField('items', index, name);
    const lineId = text(line.rfqLineId);
    v.add(
      field('rfqLineId'),
      objectId(line.rfqLineId, 'Quote against a line of this RFQ'),
      lineId && quoted.has(lineId) ? 'This item is quoted more than once' : ''
    );
    if (lineId) quoted.add(lineId);
    // A line bound to the RFQ takes the RFQ's description; one that is not needs its own.
    if (!lineId) {
      v.add(field('description'), required(line.description, 'Enter the item description'), maxLength(line.description, TEXT_LIMITS.long, 'Description'));
    }
    v.add(field('quantity'), quantity(line.quantity));
    v.add(
      field('unitPrice'),
      required(line.unitPrice, 'Enter a unit price'),
      number(line.unitPrice, { label: 'Unit price', greaterThan: 0, decimals: 2 })
    );
    v.add(field('brand'), maxLength(line.brand, TEXT_LIMITS.name, 'Brand'));
    v.add(field('notes'), maxLength(line.notes, TEXT_LIMITS.long, 'Notes'));
    v.add(field('alternativeDescription'), maxLength(line.alternativeDescription, TEXT_LIMITS.short, 'Description'));
    v.add(field('alternativePartNumber'), maxLength(line.alternativePartNumber, TEXT_LIMITS.name, 'Part number'));
    v.add(field('attachments'), validateQuoteLinePhotos(line.attachments));
  });
  return v.errors;
}

// ─── Deciding on a quotation ──────────────────────────────────────────────

/** Accept a quotation. Nothing is asked for; a comment sent with it is kept short. */
export function validateQuotationAcceptance(input: { comments?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('comments', maxLength(input.comments, TEXT_LIMITS.long, 'Comments'));
  return v.errors;
}

/** Reject a quotation: from the quotation's page and from the quotations list. */
export function validateQuotationRejection(input: { reason?: unknown; comments?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('reason', reason(input.reason, 'Give a reason for rejecting this quotation'));
  v.add('comments', maxLength(input.comments, TEXT_LIMITS.long, 'Comments'));
  return v.errors;
}

/** Ask the supplier for a revised price. */
export function validateQuotationRevisionRequest(input: { reason?: unknown; targetNote?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('reason', reason(input.reason, 'Give a reason for asking for a revised price'));
  v.add('targetNote', maxLength(input.targetNote, TEXT_LIMITS.long, 'Target'));
  return v.errors;
}

/** Procurement selects the winning quotation, with a justification. */
export function validateQuotationSelection(input: { quotationId?: unknown; justification?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('quotationId', required(input.quotationId, 'Choose a quotation'), objectId(input.quotationId, 'Choose a quotation'));
  v.add('justification', reason(input.justification, 'Explain why this quotation is selected'));
  return v.errors;
}

/** Waive the three-quotation rule for a whole RFQ. Revoking one (`approve: false`) needs no type. */
export function validateQuotationWaiver(input: { waiverType?: unknown; reason?: unknown; approve?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add(
    'waiverType',
    input.approve === false ? '' : required(input.waiverType, 'Choose the waiver type'),
    oneOf(input.waiverType, WAIVER_TYPES, 'Choose a waiver type from the list')
  );
  v.add('reason', reason(input.reason, 'Give the reason for the waiver'));
  return v.errors;
}

// ─── Split award, line by line ────────────────────────────────────────────

/** Award one RFQ line to one supplier's bid. */
export function validateLineSelection(input: { rfqLineId?: unknown; quotationId?: unknown; justification?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('rfqLineId', required(input.rfqLineId, 'Choose the line to award'), objectId(input.rfqLineId, 'Choose the line to award'));
  v.add('quotationId', required(input.quotationId, 'Choose the bid to award'), objectId(input.quotationId, 'Choose the bid to award'));
  v.add('justification', reason(input.justification, 'Explain why this line goes to this supplier'));
  return v.errors;
}

/** Waive the three-quotation rule for one line. */
export function validateLineWaiver(input: { rfqLineId?: unknown; waiverType?: unknown; reason?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('rfqLineId', required(input.rfqLineId, 'Choose the line to waive'), objectId(input.rfqLineId, 'Choose the line to waive'));
  v.merge(validateQuotationWaiver({ waiverType: input.waiverType, reason: input.reason }));
  return v.errors;
}
