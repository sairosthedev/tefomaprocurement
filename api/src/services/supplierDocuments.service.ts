import type { Response } from 'express';
import {
  computeKysCompletionForTier,
  getChecklistKeyForDocType,
  isKnownKysDocumentType
} from '@fossil/shared';
import type { ISupplierProfile, IComplianceDocument } from '../models/SupplierProfile.model.js';
import { isExpiringType } from './documentExpiry.service.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB per document

/**
 * Document files are stored inline on the supplier record as base64 data URIs
 * (up to 5MB each). Anything that lists or returns a supplier must leave them
 * out: a supplier with a full KYS file is tens of megabytes, far past Vercel's
 * 4.5MB response cap, and the hourly job would hold every one in memory. The
 * viewer fetches one file at a time from the /file endpoints instead.
 */
export const WITHOUT_DOCUMENT_FILES = '-complianceDocuments.filePath';

/** A compliance document without its file body. */
export function withoutFileBody<T>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc;
  const plain: any = typeof (doc as any).toObject === 'function' ? (doc as any).toObject() : { ...(doc as any) };
  delete plain.filePath;
  return plain;
}

/**
 * A supplier (mongoose document or plain object) as plain JSON without any
 * document file bodies — for responses from routes that had to load the full
 * record to modify it.
 */
export function withoutDocumentFiles<T>(supplier: T): T {
  if (!supplier || typeof supplier !== 'object') return supplier;
  const plain: any =
    typeof (supplier as any).toJSON === 'function' ? (supplier as any).toJSON() : { ...(supplier as any) };
  if (Array.isArray(plain.complianceDocuments)) {
    plain.complianceDocuments = plain.complianceDocuments.map((d: any) => withoutFileBody(d));
  }
  return plain;
}

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

/**
 * Only these are served under their own type. The type is whatever the
 * uploader's browser claimed, so anything else (HTML, SVG, scripts) goes out
 * as a download rather than as something a browser might render.
 */
const SERVABLE_MIME = new Set(Object.values(EXTENSION_MIME));

/** Decode a stored document into bytes, with the type it should be served as. */
export function decodeDocumentFile(
  doc: Pick<IComplianceDocument, 'filePath' | 'fileName' | 'mimeType'>
): { buffer: Buffer; mimeType: string; fileName: string } | null {
  const stored = doc?.filePath;
  if (!stored) return null;

  let declared: string | undefined;
  let buffer: Buffer;
  if (stored.startsWith('data:')) {
    const comma = stored.indexOf(',');
    if (comma === -1) return null;
    const meta = stored.slice(5, comma);
    const payload = stored.slice(comma + 1);
    declared = meta.split(';')[0] || undefined;
    buffer = meta.includes(';base64')
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
  } else {
    // Uploads may arrive as raw base64 without the data: prefix.
    buffer = Buffer.from(stored, 'base64');
  }

  const ext = doc.fileName?.split('.').pop()?.toLowerCase();
  const candidate = (doc.mimeType || declared || (ext && EXTENSION_MIME[ext]) || '').toLowerCase();
  const mimeType = SERVABLE_MIME.has(candidate) ? candidate : 'application/octet-stream';

  return { buffer, mimeType, fileName: doc.fileName || 'document' };
}

/** Send one stored document as a file response (or a 404 if it has no body). */
export function sendDocumentFile(
  res: Response,
  doc: Pick<IComplianceDocument, 'filePath' | 'fileName' | 'mimeType'> | undefined
): void {
  const file = doc ? decodeDocumentFile(doc) : null;
  if (!file) {
    res.status(404).json({ success: false, message: 'Document file not found' });
    return;
  }
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', String(file.buffer.length));
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
  );
  // Compliance documents are personal and commercial records: never cached,
  // never sniffed into something executable.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.status(200).end(file.buffer);
}

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

  // Documents with a validity period must say when they lapse, otherwise the
  // expiry job has nothing to act on and the checklist item stays ticked forever.
  if (isExpiringType(documentType)) {
    if (!expiryDate) {
      return {
        ok: false,
        status: 400,
        message: `An expiry date is required for ${documentType.replace(/_/g, ' ')}`
      };
    }
    const parsed = new Date(expiryDate);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, status: 400, message: 'Expiry date is not a valid date' };
    }
    if (parsed.getTime() <= Date.now()) {
      return { ok: false, status: 400, message: 'The document has already expired' };
    }
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

  // Completeness is judged against the supplier's tier, not the full 20-item
  // set: a tactical supplier needs only the statutory core. Using the flat
  // helper here would silently overwrite a correct tier-aware result.
  const completion = computeKysCompletionForTier(
    supplier.kysChecklist as Record<string, boolean>,
    (supplier as any).tier
  );
  supplier.kysComplete = completion.isComplete;

  return { ok: true };
}
