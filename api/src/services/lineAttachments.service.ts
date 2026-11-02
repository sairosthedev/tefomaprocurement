import {
  EQUIPMENT_FIELD_KEYS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_LINE,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  isValidAttachmentKind
} from '@fossil/shared';

export interface SanitiseResult<T> {
  ok: boolean;
  message?: string;
  value?: T;
}

/**
 * Keeps only known equipment keys and trims them. Returns undefined when the
 * caller sent nothing usable, so we never store an object of empty strings.
 */
export function sanitiseEquipment(raw: any): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const cleaned: Record<string, string> = {};
  for (const key of EQUIPMENT_FIELD_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    const trimmed = String(value).trim();
    if (trimmed) cleaned[key] = trimmed;
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/** Approximate decoded size of a base64 payload (base64 expands ~4/3). */
function approximateBytes(fileData: string): number {
  const payload = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  return Math.floor((payload?.length || 0) * 0.75);
}

/**
 * Validates line attachments (data-plate photos and similar). Mirrors the
 * limits used for supplier KYS documents: inline data URIs, 5MB each.
 */
export function sanitiseAttachments(
  raw: any,
  uploadedBy?: unknown
): SanitiseResult<any[] | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'Attachments must be a list' };
  }
  if (raw.length === 0) return { ok: true, value: undefined };
  if (raw.length > MAX_ATTACHMENTS_PER_LINE) {
    return {
      ok: false,
      message: `A line may carry at most ${MAX_ATTACHMENTS_PER_LINE} attachments`
    };
  }

  const cleaned: any[] = [];
  for (const entry of raw) {
    if (!entry?.fileName || !entry?.fileData) {
      return { ok: false, message: 'Each attachment needs a fileName and fileData' };
    }
    if (entry.mimeType && !ALLOWED_ATTACHMENT_MIME_TYPES.includes(entry.mimeType)) {
      return {
        ok: false,
        message: `Unsupported file type: ${entry.mimeType}. Upload a JPEG, PNG, WebP, HEIC or PDF.`
      };
    }
    if (approximateBytes(entry.fileData) > MAX_ATTACHMENT_BYTES) {
      return { ok: false, message: `${entry.fileName} exceeds the 5MB limit` };
    }

    cleaned.push({
      kind: isValidAttachmentKind(entry.kind) ? entry.kind : 'data_plate',
      fileName: String(entry.fileName).trim(),
      fileData: entry.fileData,
      mimeType: entry.mimeType,
      caption: entry.caption ? String(entry.caption).trim() : undefined,
      uploadedBy,
      uploadedAt: new Date()
    });
  }

  return { ok: true, value: cleaned };
}
