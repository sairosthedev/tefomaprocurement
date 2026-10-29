import { isProcurementHead } from '@fossil/shared';

/**
 * Masking for supplier bank account numbers.
 *
 * An account number is the one field a payment-redirection fraud needs, so it
 * is shown in full only where money is actually moved or a change is verified
 * (finance paying an invoice, procurement doing a callback). Everywhere else —
 * supplier lists, read-only oversight views, the audit trail, evidence exports
 * — it is reduced to its last four digits, which is still enough to tell two
 * accounts apart.
 */

const ACCOUNT_NUMBER_KEY = 'accountnumber';

/** "62012345678" -> "•••••••5678". Short or empty values are masked entirely. */
export function maskAccountNumber(value: unknown): string | undefined {
  if (value == null) return undefined;
  const raw = String(value).replace(/\s/g, '');
  if (!raw) return '';
  if (raw.length <= 4) return '•'.repeat(raw.length);
  return '•'.repeat(raw.length - 4) + raw.slice(-4);
}

const isAccountNumberKey = (key: string) =>
  key.toLowerCase().replace(/[^a-z]/g, '') === ACCOUNT_NUMBER_KEY;

/**
 * Deep copy with every `accountNumber` masked, at any depth. Works on mongoose
 * documents, lean objects and arrays; ObjectIds and dates pass through intact.
 */
export function maskBankNumbers<T>(value: T): T {
  const walk = (v: any): any => {
    if (v == null || typeof v !== 'object') return v;
    if (v instanceof Date) return v;
    if (typeof v.toHexString === 'function') return v;
    if (Buffer.isBuffer(v)) return v;
    if (typeof v.toObject === 'function') return walk(v.toObject());
    if (Array.isArray(v)) return v.map(walk);
    const out: any = {};
    for (const [key, inner] of Object.entries(v)) {
      out[key] = isAccountNumberKey(key) && (typeof inner === 'string' || typeof inner === 'number')
        ? maskAccountNumber(inner)
        : walk(inner);
    }
    return out;
  };
  return walk(value);
}

/** Roles that see full account numbers on a single supplier record. */
const FULL_BANK_DETAIL_ROLES = new Set(['procurement_officer', 'finance', 'admin']);

export function canSeeFullBankDetails(user: any): boolean {
  if (!user?.role) return false;
  return FULL_BANK_DETAIL_ROLES.has(user.role) || isProcurementHead(user);
}
