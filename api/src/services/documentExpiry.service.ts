import { KYS_DOCUMENT_REQUIREMENTS, getChecklistKeyForDocType, computeKysCompletionForTier } from '@fossil/shared';
import type { ISupplierProfile, IComplianceDocument } from '../models/SupplierProfile.model.js';

/**
 * Compliance-document expiry.
 *
 * `expiryDate` was stored and never read: an expired tax clearance kept its
 * checklist item ticked and the supplier stayed KYS-complete indefinitely.
 *
 * The rule copied from SAP Ariba is that the certificate's own expiry date is
 * the source of truth, and that an expired certificate cascades — in Ariba it
 * expires the questionnaire, here it unticks the checklist item the document
 * satisfied, which drops `kysComplete` and so removes the supplier from the
 * eligibility gate for NEW awards. Existing purchase orders are unaffected.
 *
 * Note Ariba's own trap, which this avoids: an imported end-date that nothing
 * acts on is "for informational purposes only". A date field with no job
 * behind it is exactly the bug this replaces.
 */

/** Document types that carry a validity period and must be re-supplied. */
export const EXPIRING_DOCUMENT_TYPES: readonly string[] = Object.freeze([
  'tax_clearance',
  'nssa_compliance',
  'insurance',
  'iso_certification',
  'industry_licence',
  'nec_registration',
  'bee_certificate'
]);

/** Reminder offsets, in days before expiry. */
export const EXPIRY_REMINDER_DAYS: readonly number[] = Object.freeze([60, 30, 7]);

export function isExpiringType(documentType: string): boolean {
  return EXPIRING_DOCUMENT_TYPES.includes(documentType);
}

/** Whether a required (not optional) KYS document type must be held. */
export function isRequiredDocumentType(documentType: string): boolean {
  return KYS_DOCUMENT_REQUIREMENTS.some(
    (r) => r.documentType === documentType && r.required
  );
}

export function daysUntil(date: Date | undefined, now: Date = new Date()): number | undefined {
  if (!date) return undefined;
  const ms = new Date(date).getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function isExpired(doc: IComplianceDocument, now: Date = new Date()): boolean {
  if (!doc.expiryDate) return false;
  return new Date(doc.expiryDate).getTime() <= now.getTime();
}

export interface ExpiryScan {
  expired: IComplianceDocument[];
  /** Documents inside a reminder window, with the window that matched. */
  expiringSoon: { doc: IComplianceDocument; daysLeft: number; window: number }[];
}

/** Classify a supplier's documents by expiry state. */
export function scanDocumentExpiry(
  supplier: ISupplierProfile,
  now: Date = new Date()
): ExpiryScan {
  const expired: IComplianceDocument[] = [];
  const expiringSoon: { doc: IComplianceDocument; daysLeft: number; window: number }[] = [];

  for (const doc of supplier.complianceDocuments || []) {
    if (!doc.expiryDate) continue;
    if (isExpired(doc, now)) {
      expired.push(doc);
      continue;
    }
    const daysLeft = daysUntil(doc.expiryDate, now);
    if (daysLeft === undefined) continue;
    // Match the tightest reminder window the document has entered.
    const window = [...EXPIRY_REMINDER_DAYS]
      .sort((a, b) => a - b)
      .find((w) => daysLeft <= w);
    if (window !== undefined) {
      expiringSoon.push({ doc, daysLeft, window });
    }
  }

  return { expired, expiringSoon };
}

/**
 * Apply expiry consequences to a supplier: untick the checklist item each
 * expired document satisfied, recompute KYS completeness, and record which
 * types lapsed. Mutates the supplier; the caller saves.
 *
 * Returns the document types newly treated as expired, so the caller can
 * decide whether to notify (nothing is notified for an already-known lapse).
 */
export function applyExpiryToKys(
  supplier: ISupplierProfile,
  now: Date = new Date()
): { expiredTypes: string[]; newlyExpired: string[]; kysCompleteChanged: boolean } {
  const { expired } = scanDocumentExpiry(supplier, now);
  const expiredTypes = expired.map((d) => d.documentType);
  const previouslyExpired = supplier.expiredDocumentTypes || [];
  const newlyExpired = expiredTypes.filter((t) => !previouslyExpired.includes(t));
  const wasComplete = supplier.kysComplete;

  for (const doc of expired) {
    const checklistKey = getChecklistKeyForDocType(doc.documentType);
    if (checklistKey) {
      (supplier.kysChecklist as any)[checklistKey] = false;
    }
  }

  supplier.expiredDocumentTypes = expiredTypes;
  supplier.hasExpiredDocuments = expiredTypes.length > 0;

  const completion = computeKysCompletionForTier(
    supplier.kysChecklist as Record<string, boolean>,
    (supplier as any).tier
  );
  supplier.kysComplete = completion.isComplete;

  return {
    expiredTypes,
    newlyExpired,
    kysCompleteChanged: wasComplete !== supplier.kysComplete
  };
}
