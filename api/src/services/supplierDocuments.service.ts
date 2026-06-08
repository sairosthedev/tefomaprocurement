import {
  computeKysCompletion,
  getChecklistKeyForDocType,
  isKnownKysDocumentType
} from '@fossil/shared';
import type { ISupplierProfile } from '../models/SupplierProfile.model.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB per document

export interface UploadDocumentInput {
  documentType: string;
  fileName: string;
  fileData: string; // base64 data URI or raw base64
  mimeType?: string;
  expiryDate?: string | Date;
  notes?: string;
}

export interface UploadDocumentResult {
  ok: boolean;
  status?: number;
  message?: string;
}

/**
 * Validates and appends a compliance document to a supplier profile, ticking
 * the matching KYS checklist item and recomputing completion. Mutates the
 * passed supplier document (caller is responsible for `.save()`).
 */
export function addComplianceDocument(
  supplier: ISupplierProfile,
  input: UploadDocumentInput,
  uploadedBy: unknown
): UploadDocumentResult {
  const { documentType, fileName, fileData, mimeType, expiryDate, notes } = input;

  if (!documentType || !isKnownKysDocumentType(documentType)) {
    return { ok: false, status: 400, message: `Unknown KYS document type: ${documentType}` };
  }
  if (!fileName || !fileData) {
    return { ok: false, status: 400, message: 'fileName and fileData are required' };
  }

  // Rough size guard — base64 expands ~4/3, so decode estimate = len * 3/4
  const base64Payload = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  const approxBytes = Math.floor((base64Payload?.length || 0) * 0.75);
  if (approxBytes > MAX_FILE_BYTES) {
    return { ok: false, status: 400, message: 'File exceeds the 5MB limit' };
  }

  supplier.complianceDocuments = supplier.complianceDocuments || [];
  // Replace any existing document of the same type (latest upload wins)
  supplier.complianceDocuments = supplier.complianceDocuments.filter(
    (d) => d.documentType !== documentType
  );
  supplier.complianceDocuments.push({
    documentType: documentType as any,
    fileName,
    filePath: fileData,
    mimeType,
    fileSize: approxBytes,
    uploadedBy: uploadedBy as any,
    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
    uploadedAt: new Date(),
    verified: false,
    notes
  } as any);

  // Auto-tick the checklist item this document satisfies
  const checklistKey = getChecklistKeyForDocType(documentType);
  if (checklistKey) {
    (supplier.kysChecklist as any)[checklistKey] = true;
  }

  const completion = computeKysCompletion(supplier.kysChecklist as Record<string, boolean>);
  supplier.kysComplete = completion.isComplete;

  return { ok: true };
}
