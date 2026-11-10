/**
 * Form validators for Requisitions and their approvals: the requisition and its items, equipment details, line
 * quantity edits, department head decisions, stores review, cancelling a requisition or
 * purchase order, and purchase order approval decisions.
 *
 * Built from the helpers in rules.ts; see that file for the conventions.
 */
import { PO_CANCELLATION_REASONS, PR_CANCELLATION_REASONS } from '../constants/cancellations.js';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ATTACHMENT_KINDS,
  EQUIPMENT_FIELDS,
  MAX_ATTACHMENTS_PER_LINE,
  MAX_ATTACHMENT_BYTES
} from '../constants/equipmentDetails.js';
import { isValidCategoryCode } from '../constants/supplierCategories.js';
import {
  FormErrors,
  TEXT_LIMITS,
  isBlank,
  lineField,
  maxLength,
  money,
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

/** Units are short words (Each, Kg, Cubic Meter); catalogue items bring their own, so there is no fixed list. */
const UNIT_MAX_LENGTH = 30;
const URGENCIES = ['normal', 'high'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/** Rough size of an inline file (a data URI or bare base64), the same sum the API makes: base64 grows by 4/3. */
function approximateBytes(fileData: unknown): number {
  const data = typeof fileData === 'string' ? fileData : '';
  const payload = data.includes(',') ? data.split(',')[1] : data;
  return Math.floor((payload?.length || 0) * 0.75);
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/* ── A requisition and its items ─────────────────────────────────────── */

export interface RequisitionAttachmentInput {
  kind?: unknown;
  fileName?: unknown;
  fileData?: unknown;
  mimeType?: unknown;
  caption?: unknown;
}

/** One photo or PDF on a requisition line. The type and size limits are the API's. */
export function validateRequisitionAttachment(input: RequisitionAttachmentInput): FieldErrors {
  const v = new FormErrors();
  const megabytes = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));
  v.add(
    'fileData',
    required(input.fileName, 'Add the file again'),
    required(input.fileData, 'Add the file again'),
    approximateBytes(input.fileData) > MAX_ATTACHMENT_BYTES ? `Use a file of ${megabytes}MB or less` : ''
  );
  v.add('mimeType', oneOf(input.mimeType, ALLOWED_ATTACHMENT_MIME_TYPES, 'Use a JPEG, PNG, WebP, HEIC or PDF file'));
  v.add('kind', oneOf(input.kind, Object.values(ATTACHMENT_KINDS), 'Choose what the photo shows'));
  v.add('caption', maxLength(input.caption, TEXT_LIMITS.short, 'Caption'));
  return v.errors;
}

/** The photos on one line: `attachments` for the count, `attachments.0.caption` for one photo. */
export function validateRequisitionAttachments(list: unknown): FieldErrors {
  const v = new FormErrors();
  if (list === undefined || list === null) return v.errors;
  if (!Array.isArray(list)) {
    v.add('attachments', 'Attach the photos again');
    return v.errors;
  }
  v.add(
    'attachments',
    list.length > MAX_ATTACHMENTS_PER_LINE ? `Attach no more than ${MAX_ATTACHMENTS_PER_LINE} photos to one item` : ''
  );
  list.forEach((attachment, index) => {
    v.merge(validateRequisitionAttachment(asRecord(attachment)), `attachments.${index}`);
  });
  return v.errors;
}

export interface RequisitionLineInput {
  /** The catalogue item, when one was picked (`item` on a stored line). */
  itemId?: unknown;
  item?: unknown;
  description?: unknown;
  category?: unknown;
  package?: unknown;
  quantity?: unknown;
  unit?: unknown;
  estimatedUnitPrice?: unknown;
  specification?: unknown;
  specifications?: unknown;
  equipment?: unknown;
  attachments?: unknown;
}

/**
 * One requisition line: the item drawer, and each line of a requisition.
 * Quantities are whole numbers, as the form has always taken them.
 */
export function validateRequisitionLine(input: RequisitionLineInput): FieldErrors {
  const v = new FormErrors();
  v.add(
    'description',
    required(input.description, 'Search the catalogue or describe the item'),
    maxLength(input.description, TEXT_LIMITS.short, 'Description'),
    objectId(input.itemId ?? input.item, 'Choose the item from the catalogue again')
  );
  v.add('category', maxLength(input.category, TEXT_LIMITS.name, 'Category'));
  // The API's copy of the shared constants has no package list yet, so the length is what is checked.
  v.add('package', maxLength(input.package, TEXT_LIMITS.name, 'Package'));
  v.add('quantity', required(input.quantity, 'Enter a quantity'), quantity(input.quantity, 'Quantity', true));
  v.add('unit', maxLength(input.unit, UNIT_MAX_LENGTH, 'Unit'));
  v.add('estimatedUnitPrice', money(input.estimatedUnitPrice, 'Estimated unit price'));
  v.add(
    'specification',
    maxLength(input.specification ?? input.specifications, TEXT_LIMITS.long, 'Specification')
  );
  const equipment = asRecord(input.equipment);
  for (const field of EQUIPMENT_FIELDS) {
    v.add(`equipment.${field.key}`, maxLength(equipment[field.key], TEXT_LIMITS.name, field.label));
  }
  v.merge(validateRequisitionAttachments(input.attachments));
  return v.errors;
}

export interface RequisitionFormInput {
  title?: unknown;
  workOrder?: unknown;
  /** The form's description; the API stores it as the justification. */
  description?: unknown;
  justification?: unknown;
  urgency?: unknown;
  priority?: unknown;
  requiredDate?: unknown;
  notes?: unknown;
  siteId?: unknown;
  items?: unknown;
}

/**
 * Raise a requisition. A draft needs a title, and whatever lines it has must
 * be whole; submitting it also needs at least one item.
 */
export function validateRequisition(
  input: RequisitionFormInput,
  { submit = false }: { submit?: boolean } = {},
  now: Date = new Date()
): FieldErrors {
  const v = new FormErrors();
  v.add('title', required(input.title, 'Enter a title'), maxLength(input.title, TEXT_LIMITS.short, 'Title'));
  v.add('description', maxLength(input.description, TEXT_LIMITS.long, 'Description'));
  v.add('justification', maxLength(input.justification, TEXT_LIMITS.long, 'Justification'));
  v.add('workOrder', maxLength(input.workOrder, TEXT_LIMITS.name, 'Work order'));
  v.add('urgency', oneOf(input.urgency, URGENCIES, 'Choose normal or high priority'));
  v.add('priority', oneOf(input.priority, PRIORITIES, 'Choose a priority from the list'));
  v.add('requiredDate', notPast(input.requiredDate, 'Required date', now));
  v.add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Notes'));
  v.add('siteId', objectId(input.siteId, 'Choose a site from the list'));

  const items = input.items;
  if (items !== undefined && items !== null && !Array.isArray(items)) {
    v.add('items', 'Add the items again');
  }
  const lines: unknown[] = Array.isArray(items) ? items : [];
  if (submit) {
    v.add('items', lines.some((line) => !isBlank(asRecord(line).description)) ? '' : 'Add at least one item');
  }
  lines.forEach((line, index) => {
    v.merge(validateRequisitionLine(asRecord(line)), `items.${index}`);
  });
  return v.errors;
}

/** Change a line's quantity while the requisition awaits approval. */
export function validateRequisitionLineQuantity(input: { quantity?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('quantity', required(input.quantity, 'Enter a quantity'), quantity(input.quantity, 'Quantity', true));
  return v.errors;
}

/* ── Department head and procurement decisions ───────────────────────── */

/**
 * Approve a requisition (the department head) or accept it (procurement).
 * Comments are optional. Approving over budget needs a reason: the screen
 * passes `overBudget` once it knows; the API asks for one with a 409 instead,
 * so here it checks a reason only when one was given.
 */
export function validateRequisitionApproval(
  input: { comments?: unknown; budgetOverrideReason?: unknown },
  { overBudget = false }: { overBudget?: boolean } = {}
): FieldErrors {
  const v = new FormErrors();
  v.add('comments', maxLength(input.comments, TEXT_LIMITS.long, 'Comments'));
  if (overBudget || !isBlank(input.budgetOverrideReason)) {
    v.add('budgetOverrideReason', reason(input.budgetOverrideReason, 'Give the reason for approving over budget'));
  }
  return v.errors;
}

/** Reject a requisition: the department head, or procurement. */
export function validateRequisitionRejection(input: { reason?: unknown; comments?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('reason', reason(input.reason, 'Give a reason for rejecting this requisition'));
  v.add('comments', maxLength(input.comments, TEXT_LIMITS.long, 'Comments'));
  return v.errors;
}

/**
 * The decision box on the requisitions list, which reads as comments when
 * approving or accepting and as the reason when rejecting.
 */
export function validateRequisitionDecision(
  input: { action?: unknown; comments?: unknown; budgetOverrideReason?: unknown },
  { overBudget = false }: { overBudget?: boolean } = {}
): FieldErrors {
  if (input.action === 'reject' || input.action === 'hod_reject') {
    return validateRequisitionRejection({ reason: input.comments, comments: input.comments });
  }
  return validateRequisitionApproval(
    { comments: input.comments, budgetOverrideReason: input.budgetOverrideReason },
    { overBudget: overBudget && input.action === 'approve' }
  );
}

/* ── Stores review ───────────────────────────────────────────────────── */

/** Stores sets one line's category during review. */
export function validateRequisitionLineCategory(input: { lineIndex?: unknown; category?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add(
    'lineIndex',
    required(input.lineIndex, 'Choose a line'),
    number(input.lineIndex, { label: 'Line', min: 0, integer: true })
  );
  v.add(
    'category',
    required(input.category, 'Choose a category'),
    isBlank(input.category) || isValidCategoryCode(text(input.category)) ? '' : 'Choose a category from the list'
  );
  return v.errors;
}

/** Notes stores adds when it fulfils a requisition from stock or processes it against stock. */
export function validateRequisitionStoresNotes(input: { notes?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Notes'));
  return v.errors;
}

/**
 * Stores forwards a requisition to procurement. Every line still owed needs a
 * category, since procurement matches suppliers on it: `items.0.category`.
 */
export function validateRequisitionStoresForward(input: { notes?: unknown; items?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.merge(validateRequisitionStoresNotes(input));
  const lines: unknown[] = Array.isArray(input.items) ? input.items : [];
  lines.forEach((entry, index) => {
    const line = asRecord(entry);
    const owed = (Number(line.quantity) || 0) - (Number(line.quantityFulfilledFromStock) || 0) > 0;
    if (owed && !isValidCategoryCode(text(line.category))) {
      v.add(lineField('items', index, 'category'), 'Choose a category');
    }
  });
  return v.errors;
}

/* ── Cancelling a requisition or a purchase order ────────────────────── */

export interface WorkflowCancellationInput {
  reasonCode?: unknown;
  comments?: unknown;
}

/** Cancel with a reason from the given list; "Other" needs the details written out. */
export function validateWorkflowCancellation(
  input: WorkflowCancellationInput,
  reasons: readonly { code: string }[]
): FieldErrors {
  const v = new FormErrors();
  v.add(
    'reasonCode',
    required(input.reasonCode, 'Choose a reason for cancelling'),
    oneOf(
      input.reasonCode,
      reasons.map((r) => r.code),
      'Choose a reason from the list'
    )
  );
  v.add(
    'comments',
    input.reasonCode === 'other'
      ? reason(input.comments, 'Explain why it is being cancelled')
      : maxLength(input.comments, TEXT_LIMITS.long, 'Notes')
  );
  return v.errors;
}

export function validateRequisitionCancellation(input: WorkflowCancellationInput): FieldErrors {
  return validateWorkflowCancellation(input, PR_CANCELLATION_REASONS);
}

export function validatePurchaseOrderCancellation(input: WorkflowCancellationInput): FieldErrors {
  return validateWorkflowCancellation(input, PO_CANCELLATION_REASONS);
}

/* ── Purchase order approvals ────────────────────────────────────────── */

/** Approve a purchase order, at any approver's step. Comments are optional. */
export function validatePurchaseOrderApproval(input: { comments?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('comments', maxLength(input.comments, TEXT_LIMITS.long, 'Comments'));
  return v.errors;
}

/** Reject a purchase order, at any approver's step. */
export function validatePurchaseOrderRejection(input: { reason?: unknown; comments?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('reason', reason(input.reason, 'Give a reason for rejecting this purchase order'));
  v.add('comments', maxLength(input.comments, TEXT_LIMITS.long, 'Comments'));
  return v.errors;
}

/** The approve or reject box on a purchase order: comments when approving, the reason when rejecting. */
export function validatePurchaseOrderDecision(input: { decision?: unknown; comment?: unknown }): FieldErrors {
  return input.decision === 'reject'
    ? validatePurchaseOrderRejection({ reason: input.comment, comments: input.comment })
    : validatePurchaseOrderApproval({ comments: input.comment });
}
