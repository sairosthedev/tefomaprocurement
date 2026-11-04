import { KYS_DOCUMENT_REQUIREMENTS, getRequiredChecklistKeys } from '@fossil/shared';

/**
 * Document types a supplier of this tier must hold. Required depth follows the
 * tier (a transactional supplier needs only CR14 and tax clearance), so the
 * flat `required` flag on each requirement overstates what a lighter tier owes.
 * Unclassified is full depth, matching the server.
 */
export function requiredDocumentTypesForTier(tier?: string): string[] {
  const keys = new Set(getRequiredChecklistKeys(tier));
  return KYS_DOCUMENT_REQUIREMENTS.filter((r) => keys.has(r.checklistKey)).map((r) => r.documentType);
}

/** Label for a document type, falling back to the type itself. */
export function documentTypeLabel(documentType: string): string {
  return (
    KYS_DOCUMENT_REQUIREMENTS.find((r) => r.documentType === documentType)?.label ||
    documentType.replace(/_/g, ' ')
  );
}
