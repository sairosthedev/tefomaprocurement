/**
 * Form validators for reviewing suppliers: status changes, activation, registration decisions,
 * risk tier, document checks, evaluations, and verifying banking changes.
 *
 * Built from the helpers in rules.ts; see that file for the conventions.
 */
import { SUPPLIER_EVALUATION_CRITERIA, SUPPLIER_TIERS, isKnownKysDocumentType } from '../constants/kys.js';
import {
  FormErrors,
  TEXT_LIMITS,
  date,
  dateKey,
  isBlank,
  maxLength,
  number,
  oneOf,
  phone,
  reason,
  required,
  text,
  todayKey,
  type FieldErrors
} from './rules.js';

// ─── Status changes and onboarding decisions ─────────────────────────────

/** The decisions taken from a supplier's page, each confirmed in the same dialog. */
export type SupplierReviewDecision =
  | 'suspend'
  | 'reactivate'
  | 'dormant'
  | 'blacklist'
  | 'reinstate'
  | 'approveActivation'
  | 'returnActivation'
  | 'rejectRegistration'
  | 'reopenRegistration';

/** The reason each decision must give. The others take an optional note. */
const DECISION_REASONS: Partial<Record<SupplierReviewDecision, string>> = {
  suspend: 'Give a reason for suspending this supplier',
  blacklist: 'Give a reason for blacklisting this supplier',
  reinstate: 'Give a reason for lifting the blacklisting',
  returnActivation: 'Give a reason for returning this request',
  rejectRegistration: 'Give a reason for rejecting this registration',
  reopenRegistration: 'Give a reason for reopening this registration'
};

/**
 * Suspend, reactivate, mark dormant, blacklist or lift a blacklisting; approve
 * or return an activation request; reject or reopen a registration.
 * Approving takes nothing but an optional note, so an empty body passes.
 */
export function validateSupplierDecision(
  decision: SupplierReviewDecision,
  input: { reason?: unknown; notes?: unknown } | null | undefined
): FieldErrors {
  const v = new FormErrors();
  const values = input || {};
  const message = Object.prototype.hasOwnProperty.call(DECISION_REASONS, decision)
    ? DECISION_REASONS[decision]
    : undefined;
  v.add('reason', message ? reason(values.reason, message) : maxLength(values.reason, TEXT_LIMITS.long, 'Reason'));
  v.add('notes', maxLength(values.notes, TEXT_LIMITS.long, 'Notes'));
  return v.errors;
}

/** The statuses PUT .../status sets, and the decision each one is. */
const STATUS_CHANGES: Record<string, SupplierReviewDecision> = {
  suspended: 'suspend',
  active: 'reactivate',
  dormant: 'dormant'
};

/** PUT .../status: suspend (a reason is required), reactivate or mark dormant. */
export function validateSupplierStatusChange(input: { status?: unknown; reason?: unknown } | null | undefined): FieldErrors {
  const v = new FormErrors();
  const values = input || {};
  v.add(
    'status',
    required(values.status, 'Choose a status'),
    oneOf(values.status, Object.keys(STATUS_CHANGES), 'Choose active, suspended or dormant')
  );
  const status = text(values.status);
  const decision = Object.prototype.hasOwnProperty.call(STATUS_CHANGES, status) ? STATUS_CHANGES[status] : 'reactivate';
  v.merge(validateSupplierDecision(decision, { reason: values.reason }));
  return v.errors;
}

/**
 * Submit a pending supplier for activation. KYS short of the supplier's tier
 * goes forward only with an override reason, so `overrideRequired` is set
 * when the checklist is incomplete.
 */
export function validateActivationSubmission(
  input: { notes?: unknown; kysOverrideReason?: unknown } | null | undefined,
  { overrideRequired = false }: { overrideRequired?: boolean } = {}
): FieldErrors {
  const v = new FormErrors();
  const values = input || {};
  v.add(
    'kysOverrideReason',
    overrideRequired
      ? reason(values.kysOverrideReason, 'Give a reason for the KYS override')
      : maxLength(values.kysOverrideReason, TEXT_LIMITS.long, 'Override reason')
  );
  v.add('notes', maxLength(values.notes, TEXT_LIMITS.long, 'Notes'));
  return v.errors;
}

/** Verify KYS and activate; activating without KYS (an override) needs a reason. */
export function validateKysOverride(input: { overrideKys?: unknown; reason?: unknown } | null | undefined): FieldErrors {
  const v = new FormErrors();
  const values = input || {};
  v.add(
    'reason',
    values.overrideKys
      ? reason(values.reason, 'Give a reason for activating without KYS')
      : maxLength(values.reason, TEXT_LIMITS.long, 'Reason')
  );
  return v.errors;
}

// ─── Risk tier ───────────────────────────────────────────────────────────

const ASSIGNABLE_TIERS: readonly string[] = SUPPLIER_TIERS.map((t) => t.key).filter((key) => key !== 'unclassified');

/** Classify a supplier: a tier other than unclassified, and why. */
export function validateTierAssignment(input: { tier?: unknown; reason?: unknown } | null | undefined): FieldErrors {
  const v = new FormErrors();
  const values = input || {};
  v.add(
    'tier',
    required(values.tier, 'Choose a tier'),
    oneOf(values.tier, ASSIGNABLE_TIERS, 'Choose critical, strategic, tactical or transactional')
  );
  v.add('reason', reason(values.reason, 'Give a reason for this tier'));
  return v.errors;
}

// ─── Know-your-supplier documents ────────────────────────────────────────

/**
 * Document types with a validity period. They are filed with an expiry date,
 * which the hourly expiry job acts on. Mirrors EXPIRING_DOCUMENT_TYPES in the
 * API's documentExpiry service.
 */
export const KYS_EXPIRING_DOCUMENT_TYPES: readonly string[] = Object.freeze([
  'tax_clearance',
  'nssa_compliance',
  'insurance',
  'iso_certification',
  'industry_licence',
  'nec_registration',
  'bee_certificate'
]);

/** Largest document accepted, as the API has always enforced it. */
export const KYS_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

/** Bytes in a data URL or raw base64 string, estimated as the API does; null when there is none. */
function base64Bytes(fileData: unknown): number | null {
  if (typeof fileData !== 'string' || !fileData) return null;
  const payload = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  return Math.floor((payload?.length || 0) * 0.75);
}

/** After today. A document that has expired, or expires today, cannot be filed. */
function afterToday(value: unknown, label: string, now: Date): string {
  const key = dateKey(value);
  if (!key) return isBlank(value) ? '' : `${label} is not a valid date`;
  return key <= todayKey(now) ? `${label} must be after today` : '';
}

export interface KysDocumentUploadInput {
  documentType?: unknown;
  fileName?: unknown;
  /** The file as a data URL or base64, as sent to the API. */
  fileData?: unknown;
  /** The chosen file's size in bytes, for the screen's check before the file is read. */
  fileSize?: unknown;
  expiryDate?: unknown;
  notes?: unknown;
}

/**
 * Upload a KYS document, by the supplier or by procurement for them. The file
 * is at most 5 MB, and a document with a validity period needs an expiry date
 * after today. The API does not restrict the file type.
 */
export function validateKysDocumentUpload(
  input: KysDocumentUploadInput | null | undefined,
  { now = new Date() }: { now?: Date } = {}
): FieldErrors {
  const v = new FormErrors();
  const values = input || {};
  const documentType = text(values.documentType);
  v.add(
    'documentType',
    required(documentType, 'Choose the document type'),
    documentType && !isKnownKysDocumentType(documentType) ? 'Choose a document type from the list' : ''
  );

  v.add('fileName', required(values.fileName, 'Choose a file to upload'), maxLength(values.fileName, 255, 'File name'));
  // The screen checks the chosen file's size before reading it; the API
  // checks the file that arrived.
  const checkingChosenFile = values.fileData === undefined && typeof values.fileSize === 'number';
  const bytes = checkingChosenFile ? (values.fileSize as number) : base64Bytes(values.fileData);
  v.add(
    'fileData',
    checkingChosenFile ? '' : required(values.fileData, 'Choose a file to upload'),
    !checkingChosenFile && !isBlank(values.fileData) && typeof values.fileData !== 'string' ? 'Choose a file to upload' : '',
    bytes !== null && bytes > KYS_DOCUMENT_MAX_BYTES ? 'Choose a file of 5 MB or less' : ''
  );

  const expiring = KYS_EXPIRING_DOCUMENT_TYPES.includes(documentType);
  v.add(
    'expiryDate',
    expiring ? required(values.expiryDate, 'Enter the expiry date') : '',
    expiring ? afterToday(values.expiryDate, 'Expiry date', now) : date(values.expiryDate, 'Expiry date')
  );
  v.add('notes', maxLength(values.notes, TEXT_LIMITS.long, 'Notes'));
  return v.errors;
}

/** Verify a document, or reject it (or withdraw its verification) with a reason. */
export function validateKysDocumentReview(input: { verified?: unknown; notes?: unknown } | null | undefined): FieldErrors {
  const v = new FormErrors();
  const values = input || {};
  v.add('verified', values.verified === undefined ? '' : oneOf(values.verified, [true, false], 'Choose verify or reject'));
  v.add(
    'notes',
    values.verified === false
      ? reason(values.notes, 'Give a reason for rejecting this document')
      : maxLength(values.notes, TEXT_LIMITS.long, 'Notes')
  );
  return v.errors;
}

// ─── Evaluations ─────────────────────────────────────────────────────────

const EVALUATION_TYPE_VALUES: readonly string[] = ['initial', 're_evaluation', 'quarterly_review'];
const EVALUATION_RECOMMENDATION_VALUES: readonly string[] = ['approve', 'reject', 'conditional', 're_evaluate_later'];

export interface SupplierEvaluationInput {
  evaluationType?: unknown;
  recommendation?: unknown;
  /** One score per criterion, 1 to 5; the notes travel here as `otherNotes`. */
  scores?: Record<string, unknown> | null;
  /** Older callers sent the notes at the top level. */
  otherNotes?: unknown;
}

/** Record a supplier evaluation: every criterion scored 1 to 5, and a recommendation. */
export function validateSupplierEvaluation(input: SupplierEvaluationInput | null | undefined): FieldErrors {
  const v = new FormErrors();
  const values = input || {};
  const scores = values.scores;
  const hasScores = !!scores && typeof scores === 'object' && !Array.isArray(scores);
  if (!hasScores) {
    v.add('scores', 'Score the supplier on each criterion');
  } else {
    for (const criterion of SUPPLIER_EVALUATION_CRITERIA) {
      const value = scores[criterion.key];
      v.add(
        `scores.${criterion.key}`,
        required(value, 'Give a score from 1 to 5'),
        number(value, { label: 'Score', min: 1, max: 5 })
      );
    }
  }
  v.add('evaluationType', oneOf(values.evaluationType, EVALUATION_TYPE_VALUES, 'Choose an evaluation type from the list'));
  v.add(
    'recommendation',
    required(values.recommendation, 'Choose a recommendation'),
    oneOf(values.recommendation, EVALUATION_RECOMMENDATION_VALUES, 'Choose a recommendation from the list')
  );
  const notes = hasScores && scores.otherNotes !== undefined ? scores.otherNotes : values.otherNotes;
  v.add('otherNotes', maxLength(notes, TEXT_LIMITS.long, 'Notes'));
  return v.errors;
}

// ─── Banking changes ─────────────────────────────────────────────────────

export interface BankChangeCallbackInput {
  numberCalled?: unknown;
  confirmedBy?: unknown;
  notes?: unknown;
  overrideNumberCheck?: unknown;
  overrideReason?: unknown;
}

/**
 * Record the callback that verifies a banking change: the number called and
 * who at the supplier confirmed it. Calling a number not on file is an
 * override, and needs a reason.
 */
export function validateBankChangeCallback(input: BankChangeCallbackInput | null | undefined): FieldErrors {
  const v = new FormErrors();
  const values = input || {};
  v.add(
    'numberCalled',
    required(values.numberCalled, 'Enter the number you called'),
    phone(values.numberCalled),
    maxLength(values.numberCalled, TEXT_LIMITS.phone, 'Number')
  );
  v.add(
    'confirmedBy',
    required(values.confirmedBy, 'Enter who at the supplier confirmed the change'),
    maxLength(values.confirmedBy, TEXT_LIMITS.name, 'Name')
  );
  v.add('notes', maxLength(values.notes, TEXT_LIMITS.long, 'Notes'));
  v.add(
    'overrideReason',
    values.overrideNumberCheck
      ? reason(values.overrideReason, 'Give a reason for calling a number that is not on file')
      : maxLength(values.overrideReason, TEXT_LIMITS.long, 'Override reason')
  );
  return v.errors;
}

/** Reject a banking change; the supplier's details stay as they were. */
export function validateBankChangeRejection(input: { reason?: unknown } | null | undefined): FieldErrors {
  const v = new FormErrors();
  v.add('reason', reason((input || {}).reason, 'Give a reason for rejecting this banking change'));
  return v.errors;
}
