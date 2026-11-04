import {
  KYS_DOCUMENT_REQUIREMENTS,
  getChecklistKeyForDocType,
  getRequiredChecklistKeys
} from '@fossil/shared';
import { SupplierProfile } from '../models/index.js';
import { escapeRegex } from '../lib/regex.js';

/**
 * Is a supplier eligible to transact right now?
 *
 * Supplier status was previously checked only at RFQ creation, so a supplier
 * blacklisted or suspended afterwards could still be published to, have their
 * quotation accepted, and be issued a purchase order. This is the single gate
 * the whole sourcing chain calls, re-checked at each step that commits the
 * company to a supplier.
 *
 * The bar rises with the stage. Invitation is deliberately the widest gate: a
 * `pending` supplier may be invited to quote, because asking for a price
 * commits nothing and narrow sourcing is how you end up with one bid. Award
 * and purchase-order both require an `active`, spend-authorized supplier with
 * KYS complete (or explicitly exempt).
 *
 * KYS and transactability are checked directly rather than trusting status as
 * a proxy: activation normally requires `kysComplete || kysExempt`, but
 * `secApproveEvaluation` could once flip a supplier to active without it.
 */

export type EligibilityStage = 'invite' | 'award' | 'order';

export interface EligibilityResult {
  eligible: boolean;
  /** Human-readable reason, suitable for an API error message. */
  reason?: string;
  supplier?: any;
}

const STATUS_REASON: Record<string, string> = {
  pending: 'is still pending KYS verification',
  suspended: 'is suspended',
  blacklisted: 'is blacklisted',
  dormant: 'is marked dormant'
};

const STAGE_VERB: Record<EligibilityStage, string> = {
  invite: 'invited to an RFQ',
  award: 'awarded a quotation',
  order: 'issued a purchase order'
};

/**
 * What the gate reads. The document fields are type and expiry only — never
 * the file bodies, which are stored inline and can run to megabytes.
 */
const ELIGIBILITY_FIELDS =
  'companyName status kysComplete kysExempt isDeleted transactability expiredDocumentTypes tier ' +
  'complianceDocuments.documentType complianceDocuments.expiryDate';

/**
 * The first document on file that the supplier's tier requires and that has
 * passed its expiry date.
 *
 * The expiry job that unticks lapsed documents only runs on a long-lived
 * server, so on a serverless deployment `kysComplete` can stay true after a
 * tax clearance lapses. Reading the dates here makes the gate hold regardless.
 * A supplier with no documents on file is unaffected: their KYS stands on the
 * checklist, and is judged by the check above.
 */
export function findLapsedRequiredDocument(
  supplier: any,
  now: Date = new Date()
): { documentType: string; label: string; expiryDate: Date } | undefined {
  const docs: any[] = Array.isArray(supplier?.complianceDocuments) ? supplier.complianceDocuments : [];
  if (docs.length === 0) return undefined;

  const requiredKeys = new Set(getRequiredChecklistKeys(supplier.tier));
  for (const doc of docs) {
    if (!doc?.expiryDate) continue;
    const expiry = new Date(doc.expiryDate);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() > now.getTime()) continue;
    const key = getChecklistKeyForDocType(doc.documentType);
    if (!key || !requiredKeys.has(key)) continue;
    const label =
      KYS_DOCUMENT_REQUIREMENTS.find((r) => r.documentType === doc.documentType)?.label ||
      String(doc.documentType).replace(/_/g, ' ');
    return { documentType: doc.documentType, label, expiryDate: expiry };
  }
  return undefined;
}

/** Evaluate an already-loaded supplier document. */
export function checkSupplierEligibility(
  supplier: any,
  stage: EligibilityStage
): EligibilityResult {
  if (!supplier || supplier.isDeleted) {
    return { eligible: false, reason: 'Supplier not found' };
  }

  const name = supplier.companyName || 'Supplier';

  // A pending supplier may be invited to quote: sourcing widely is how you get
  // competitive prices, and nothing is committed by asking for a quotation.
  // Every later stage still requires full activation.
  const invitable = supplier.status === 'active' || (stage === 'invite' && supplier.status === 'pending');

  if (!invitable) {
    const detail = STATUS_REASON[supplier.status] || `has status '${supplier.status}'`;
    return {
      eligible: false,
      reason: `${name} ${detail} and cannot be ${STAGE_VERB[stage]}.`,
      supplier
    };
  }

  // KYS gates award and payment, not invitation — an invited supplier can
  // complete their KYS while the RFQ is open.
  if (stage !== 'invite' && !supplier.kysComplete && !supplier.kysExempt) {
    const expired = supplier.expiredDocumentTypes?.length
      ? ` Expired document(s): ${supplier.expiredDocumentTypes.join(', ')}.`
      : '';
    return {
      eligible: false,
      reason: `${name} has not completed KYS verification and cannot be ${STAGE_VERB[stage]}.${expired}`,
      supplier
    };
  }

  // An explicit KYS exemption covers documents too, as it always has.
  if (stage !== 'invite' && !supplier.kysExempt) {
    const lapsed = findLapsedRequiredDocument(supplier);
    if (lapsed) {
      return {
        eligible: false,
        reason: `${name}'s ${lapsed.label} expired on ${lapsed.expiryDate.toISOString().slice(0, 10)}, so they cannot be ${STAGE_VERB[stage]} until a current one is uploaded.`,
        supplier
      };
    }
  }

  // Transactability is tracked separately from lifecycle status: a prospective
  // supplier may be invited to quote, but only a spend-authorized one may be
  // awarded or issued a purchase order.
  //
  // A missing value counts as NOT authorized. This gate controls whether money
  // can be committed, so it fails closed: a legacy record, or a query whose
  // projection drops the field, must not be read as permission to pay.
  if (stage !== 'invite' && supplier.transactability !== 'spend_authorized') {
    return {
      eligible: false,
      reason: `${name} is not spend-authorized and cannot be ${STAGE_VERB[stage]}.`,
      supplier
    };
  }

  return { eligible: true, supplier };
}

/** Load a supplier by id and evaluate eligibility. */
export async function checkSupplierIdEligibility(
  supplierId: any,
  stage: EligibilityStage
): Promise<EligibilityResult> {
  const supplier = await SupplierProfile.findById(supplierId).select(ELIGIBILITY_FIELDS).lean();
  return checkSupplierEligibility(supplier, stage);
}

/**
 * Partition a list of supplier ids into those that may transact and those that
 * may not. Used when publishing an RFQ, where some invitees may have been
 * blacklisted since the draft was created.
 */
export async function partitionEligibleSuppliers(
  supplierIds: any[],
  stage: EligibilityStage
): Promise<{ eligible: any[]; ineligible: { supplierId: any; reason: string }[] }> {
  const suppliers = await SupplierProfile.find({
    _id: { $in: supplierIds }
  }).select(ELIGIBILITY_FIELDS).lean();

  const byId = new Map(suppliers.map((s) => [String(s._id), s]));
  const eligible: any[] = [];
  const ineligible: { supplierId: any; reason: string }[] = [];

  for (const id of supplierIds) {
    const result = checkSupplierEligibility(byId.get(String(id)), stage);
    if (result.eligible) {
      eligible.push(id);
    } else {
      ineligible.push({ supplierId: id, reason: result.reason || 'Not eligible' });
    }
  }

  return { eligible, ineligible };
}

export type SupplierStatus = 'pending' | 'active' | 'suspended' | 'blacklisted' | 'dormant';

/**
 * Move a supplier to a lifecycle status, keeping transactability in step and
 * recording why. Mutates the supplier; the caller saves.
 *
 * Several routes moved `status` without touching transactability, so a
 * supplier could read "Active" and still be refused at award for not being
 * spend-authorized. Activation grants spend authorization exactly as
 * approveSupplier does (only stamped when it changes); suspension,
 * blacklisting, dormancy and return to pending withdraw it.
 */
export function transitionSupplierStatus(
  supplier: any,
  to: SupplierStatus,
  by: unknown,
  reason?: unknown
): void {
  const from = supplier.status;
  const why = typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;
  supplier.status = to;

  const transactability = to === 'active' ? 'spend_authorized' : 'none';
  if (supplier.transactability !== transactability) {
    supplier.transactability = transactability;
    supplier.transactabilityChangedBy = by;
    supplier.transactabilityChangedAt = new Date();
  }

  // Reasons live here rather than in `notes`, which is the supplier's own
  // description of their services and was being overwritten.
  supplier.statusHistory = [
    ...(supplier.statusHistory || []),
    { from, to, reason: why, by, at: new Date() }
  ];
}

/**
 * Registration numbers are typed by hand ("2024/123456-07", "2024/123 456 07"),
 * so they are compared ignoring case, spaces and hyphens.
 */
export function normaliseRegistrationNumber(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

export const BLACKLISTED_COMPANY_MESSAGE = 'This company cannot be registered. Contact procurement.';
export const DUPLICATE_COMPANY_MESSAGE = 'This company is already registered — sign in, or contact procurement.';

/**
 * Is a company with this registration number already on the register?
 *
 * Nothing used to stop a company registering twice — including one that had
 * been blacklisted, which could simply sign up again under a new login.
 * Returns the refusal to give, or null if the number is free. A blacklisted
 * match gets a neutral message so the register's contents are not disclosed.
 *
 * No unique index: existing data may already hold duplicates, and the check
 * has to tolerate formatting differences an index could not.
 */
export async function registrationConflict(
  registrationNumber: unknown
): Promise<{ blacklisted: boolean; message: string } | null> {
  const wanted = normaliseRegistrationNumber(registrationNumber);
  if (!wanted) return null;

  // Match the same characters with any spaces or hyphens between them, then
  // confirm in code — the pattern narrows, the normalised comparison decides.
  const gap = String.raw`[\s-]*`;
  const pattern = `^${gap}${wanted.split('').map(escapeRegex).join(gap)}${gap}$`;
  const candidates = await SupplierProfile.find({
    isDeleted: { $ne: true },
    registrationNumber: { $regex: pattern, $options: 'i' }
  })
    .select('registrationNumber status')
    .lean();

  const matches = candidates.filter((c: any) => normaliseRegistrationNumber(c.registrationNumber) === wanted);
  if (matches.length === 0) return null;
  if (matches.some((c: any) => c.status === 'blacklisted')) {
    return { blacklisted: true, message: BLACKLISTED_COMPANY_MESSAGE };
  }
  return { blacklisted: false, message: DUPLICATE_COMPANY_MESSAGE };
}
