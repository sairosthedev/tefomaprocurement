import type { Request } from 'express';
import { AuditLog } from '../models/index.js';

export interface AuditLogOptions {
  action: string;
  entity: string;
  entityId?: unknown;
  /** Human-readable reference, e.g. "PR-2026-014". Derived from the data when omitted. */
  entityLabel?: string;
  user?: any;
  description?: string;
  previousData?: unknown;
  newData?: unknown;
  /** Resulting workflow status. Derived from newData.status when omitted. */
  status?: string;
  metadata?: unknown;
  req?: Request;
}

/** Keys whose values must never reach the audit trail. */
const SENSITIVE_KEYS = [
  'password', 'newpassword', 'currentpassword', 'confirmpassword',
  'token', 'refreshtoken', 'accesstoken', 'resettoken',
  'otp', 'otpcode', 'secret', 'apikey', 'authorization'
];

const isSensitive = (key: string) =>
  SENSITIVE_KEYS.includes(key.toLowerCase().replace(/[^a-z]/g, ''));

/** Fields that change on every write and carry no audit value. */
const NOISE_KEYS = ['updatedat', 'createdat', '__v', '_id', 'id'];

const isNoise = (key: string) => NOISE_KEYS.includes(key.toLowerCase());

/** Common reference-number fields, most specific first. */
const LABEL_KEYS = [
  'requisitionNumber', 'rfqNumber', 'quotationNumber', 'poNumber',
  'orderNumber', 'invoiceNumber', 'paymentNumber', 'deliveryNumber',
  'grvNumber', 'storesIssueNumber', 'code', 'stockCode',
  'reference', 'name', 'title', 'email'
];

/** Strip mongoose documents, ObjectIds and dates down to plain comparable values. */
const toPlain = (value: any): any => {
  if (value == null) return value;
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
};

const normalise = (value: any): any => {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // ObjectIds and other wrappers stringify to something comparable.
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (Array.isArray(value)) return value.map(normalise);
  }
  return value;
};

const sameValue = (a: any, b: any) => {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return true;
  if (na == null || nb == null) return false;
  if (typeof na === 'object' || typeof nb === 'object') {
    try {
      return JSON.stringify(na) === JSON.stringify(nb);
    } catch {
      return false;
    }
  }
  return false;
};

const redact = (data: any): any => {
  const plain = toPlain(data);
  if (plain == null || typeof plain !== 'object' || Array.isArray(plain)) return plain;

  const out: any = {};
  for (const [key, value] of Object.entries(plain)) {
    if (isSensitive(key)) {
      out[key] = '[redacted]';
    } else if (!isNoise(key)) {
      out[key] = normalise(value);
    }
  }
  return out;
};

/**
 * Build a field-level diff so the UI can show "status: pending_hod -> approved"
 * instead of asking a reviewer to eyeball two JSON blobs.
 */
const buildChanges = (
  previousData: any,
  newData: any
): { field: string; from: any; to: any }[] => {
  // Compare the raw values, not the redacted ones: two "[redacted]" strings look
  // equal, which would hide the very fact that a credential was changed.
  const before = toPlain(previousData);
  const after = toPlain(newData);
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') {
    return [];
  }

  const changes: { field: string; from: any; to: any }[] = [];
  for (const key of Object.keys(after)) {
    if (isNoise(key) || sameValue(before[key], after[key])) continue;
    if (isSensitive(key)) {
      // Record that it changed, never what it changed to.
      changes.push({ field: key, from: '[redacted]', to: '[changed]' });
    } else {
      changes.push({
        field: key,
        from: normalise(before[key]) ?? null,
        to: normalise(after[key]) ?? null
      });
    }
  }
  return changes;
};

const deriveLabel = (options: AuditLogOptions): string | undefined => {
  const sources = [toPlain(options.newData), toPlain(options.previousData)];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of LABEL_KEYS) {
      const value = (source as any)[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return undefined;
};

/** Honour the proxy chain so logs record the client, not the load balancer. */
const clientIp = (req?: Request): string | undefined => {
  if (!req) return undefined;
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip =
    first?.split(',')[0]?.trim() ||
    req.ip ||
    (req as any)?.connection?.remoteAddress;
  // Normalise IPv4-mapped IPv6 (::ffff:10.0.0.1) down to the readable form.
  return ip?.replace(/^::ffff:/, '');
};

export const createAuditLog = async (options: AuditLogOptions): Promise<void> => {
  try {
    const {
      action, entity, entityId, user, description,
      previousData, newData, metadata, req
    } = options;

    const previous = redact(previousData);
    const next = redact(newData);

    await AuditLog.create({
      action,
      entity,
      entityId,
      entityLabel: options.entityLabel || deriveLabel(options),
      user: user?._id || user,
      userEmail: user?.email,
      userRole: user?.role,
      description,
      previousData: previous,
      newData: next,
      changes: buildChanges(previousData, newData),
      status: options.status || (next && typeof next === 'object' ? next.status : undefined),
      metadata: redact(metadata),
      ipAddress: clientIp(req),
      userAgent: req?.headers?.['user-agent'],
      method: req?.method,
      path: (req as any)?.originalUrl || req?.path
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};
