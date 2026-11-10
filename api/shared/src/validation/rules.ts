/**
 * Form rules shared by the screens and the API.
 *
 * Each form has one validator, written with these helpers in the area file
 * next to this one. The screen runs it before sending, to show the problem
 * under the field; the API runs the same validator on what arrives, so a
 * request that skips the screen is refused for the same reasons, in the same
 * words.
 *
 * Every rule returns a message, or '' when the value is fine. Only `required`
 * complains about an empty value: the others pass it, so an optional field is
 * checked only when something was typed into it.
 *
 * Validators check shape (present, a number, a real date, a valid email, not
 * too long). They do not change policy: a field becomes required here only
 * when the server or the record already required it.
 */

/** Field name to message. Line items use `items.0.quantity`. */
export type FieldErrors = Record<string, string>;

/** A rule's answer: a message, or '' (or nothing) when the value is fine. */
export type RuleResult = string | false | null | undefined;

/** Longest text accepted for common kinds of field. */
export const TEXT_LIMITS = Object.freeze({
  code: 20,
  name: 120,
  short: 200,
  long: 2000,
  email: 254,
  phone: 30
});

/** Matches the server's existing minimum. Raising it is a policy decision. */
export const PASSWORD_MIN_LENGTH = 6;

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** The value as trimmed text, '' for nothing. */
export function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function required(value: unknown, message: string): string {
  return isBlank(value) ? message : '';
}

export function maxLength(value: unknown, max: number, label: string): string {
  if (isBlank(value)) return '';
  return text(value).length > max ? `${label} must be ${max} characters or fewer` : '';
}

export function minLength(value: unknown, min: number, label: string): string {
  if (isBlank(value)) return '';
  return text(value).length < min ? `${label} must be at least ${min} characters` : '';
}

export function pattern(value: unknown, re: RegExp, message: string): string {
  if (isBlank(value)) return '';
  return re.test(text(value)) ? '' : message;
}

export function oneOf(value: unknown, allowed: readonly unknown[], message: string): string {
  if (isBlank(value)) return '';
  return allowed.includes(value) ? '' : message;
}

export function sameAs(value: unknown, other: unknown, message: string): string {
  if (isBlank(value)) return '';
  return text(value) === text(other) ? '' : message;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

export function email(value: unknown, message = 'Enter a valid email address, like name@company.co.zw'): string {
  if (isBlank(value)) return '';
  const v = text(value);
  return v.length <= TEXT_LIMITS.email && EMAIL_RE.test(v) ? '' : message;
}

/** Digits with optional +, spaces, dashes, dots and brackets; 7 to 15 digits. */
export function phone(value: unknown, message = 'Enter a valid phone number, like +263 77 123 4567'): string {
  if (isBlank(value)) return '';
  const v = text(value);
  if (!/^\+?[\d\s().-]+$/.test(v)) return message;
  const digits = v.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15 ? '' : message;
}

/** A web address. "www.example.co.zw" is accepted as well as "https://...". */
export function url(value: unknown, message = 'Enter a web address, like https://www.example.co.zw'): string {
  if (isBlank(value)) return '';
  const v = text(value);
  if (/\s/.test(v)) return message;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.hostname.includes('.') ? '' : message;
  } catch {
    return message;
  }
}

export function password(value: unknown, label = 'Password'): string {
  if (isBlank(value)) return '';
  return String(value).length < PASSWORD_MIN_LENGTH
    ? `${label} must be at least ${PASSWORD_MIN_LENGTH} characters`
    : '';
}

/** Shortest reason accepted where one must be given: a few words, not a stray key. */
export const REASON_MIN_LENGTH = 3;

/**
 * A reason someone must give: rejecting, returning, overriding a control.
 * Required, at least a short word with a letter in it, and not an essay.
 */
export function reason(value: unknown, message: string, max: number = TEXT_LIMITS.long): string {
  if (isBlank(value)) return message;
  const v = text(value);
  if (v.length < REASON_MIN_LENGTH || !/\p{L}/u.test(v)) return 'Give the reason in a few words';
  return v.length > max ? `Keep the reason to ${max} characters or fewer` : '';
}

/** A Mongo id, for references sent by the screen (a supplier, an item, a site). */
export function objectId(value: unknown, message: string): string {
  if (isBlank(value)) return '';
  return /^[a-f\d]{24}$/i.test(text(value)) ? '' : message;
}

/** The value as a number, null when empty, NaN when not a number. */
export function toNumber(value: unknown): number | null {
  if (isBlank(value)) return null;
  if (typeof value === 'number') return value;
  const n = Number(text(value));
  return Number.isFinite(n) ? n : NaN;
}

export interface NumberRule {
  label: string;
  /** Lowest allowed value, inclusive. */
  min?: number;
  /** Highest allowed value, inclusive. */
  max?: number;
  /** The value must be above this, e.g. 0 for a quantity. */
  greaterThan?: number;
  integer?: boolean;
  /** Most decimal places allowed, e.g. 2 for money. */
  decimals?: number;
}

export function number(value: unknown, rule: NumberRule): string {
  const n = toNumber(value);
  if (n === null) return '';
  const { label } = rule;
  if (Number.isNaN(n)) return `${label} must be a number`;
  if (rule.integer && !Number.isInteger(n)) return `${label} must be a whole number`;
  if (rule.greaterThan !== undefined && !(n > rule.greaterThan)) {
    return `${label} must be more than ${rule.greaterThan}`;
  }
  if (rule.min !== undefined && n < rule.min) {
    return rule.min === 0 ? `${label} cannot be negative` : `${label} must be at least ${rule.min}`;
  }
  if (rule.max !== undefined && n > rule.max) return `${label} must be ${rule.max} or less`;
  if (rule.decimals !== undefined) {
    const [, fraction = ''] = String(n).split('.');
    if (fraction.length > rule.decimals) {
      return rule.decimals === 0
        ? `${label} must be a whole number`
        : `${label} can have at most ${rule.decimals} decimal places`;
    }
  }
  return '';
}

/** Above zero. Pass `integer: true` for things counted in whole units. */
export function quantity(value: unknown, label = 'Quantity', integer = false): string {
  return number(value, { label, greaterThan: 0, integer });
}

/** Zero or more, to the cent. */
export function money(value: unknown, label = 'Amount'): string {
  return number(value, { label, min: 0, decimals: 2 });
}

/**
 * Days are counted in Zimbabwe time (UTC+2, no daylight saving) wherever the
 * check runs. The API runs on UTC, which is still on yesterday for the first
 * two hours of a Zimbabwean day; counting in each machine's own time would
 * refuse a document dated today there while the screen allowed it.
 */
export const BUSINESS_UTC_OFFSET_HOURS = 2;

/**
 * YYYY-MM-DD for a date input's value ("2026-11-16"), a date-time input's
 * value ("2026-11-16T14:30", taken as written), a Date, or an ISO string with
 * a time zone (read as the day it is in Zimbabwe); null when not a date.
 */
export function dateKey(value: unknown): string | null {
  if (isBlank(value)) return null;
  if (typeof value === 'string') {
    const local = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.exec(value.trim());
    if (local) {
      const key = local[1];
      const check = new Date(`${key}T00:00:00Z`);
      return Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== key ? null : key;
    }
  }
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + BUSINESS_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD in Zimbabwe, on the screen and on the server alike. */
export function todayKey(now: Date = new Date()): string {
  return dateKey(now) as string;
}

export function date(value: unknown, label: string): string {
  if (isBlank(value)) return '';
  return dateKey(value) ? '' : `${label} is not a valid date`;
}

/** Today or later, e.g. a required-by or delivery date. */
export function notPast(value: unknown, label: string, now: Date = new Date()): string {
  const key = dateKey(value);
  if (!key) return isBlank(value) ? '' : `${label} is not a valid date`;
  return key < todayKey(now) ? `${label} cannot be in the past` : '';
}

/** Today or earlier, e.g. a delivery date or an invoice date. */
export function notFuture(value: unknown, label: string, now: Date = new Date()): string {
  const key = dateKey(value);
  if (!key) return isBlank(value) ? '' : `${label} is not a valid date`;
  return key > todayKey(now) ? `${label} cannot be in the future` : '';
}

/** On or after another date, e.g. a closing date after the opening date. */
export function notBefore(value: unknown, other: unknown, message: string): string {
  const a = dateKey(value);
  const b = dateKey(other);
  if (!a || !b) return '';
  return a < b ? message : '';
}

/**
 * Collects the first problem with each field.
 *
 *   const v = new FormErrors();
 *   v.add('name', required(input.name, 'Enter a name'), maxLength(input.name, 120, 'Name'));
 *   return v.errors;
 */
export class FormErrors {
  readonly errors: FieldErrors = {};

  /** Records the first message given; a field that already has one keeps it. */
  add(field: string, ...results: RuleResult[]): this {
    if (this.errors[field]) return this;
    const message = results.find((r): r is string => typeof r === 'string' && r.length > 0);
    if (message) this.errors[field] = message;
    return this;
  }

  /** Copies another validator's errors in, under a prefix such as `items.0`. */
  merge(errors: FieldErrors, prefix = ''): this {
    for (const [field, message] of Object.entries(errors)) {
      this.add(prefix ? `${prefix}.${field}` : field, message);
    }
    return this;
  }

  get ok(): boolean {
    return Object.keys(this.errors).length === 0;
  }
}

export function hasErrors(errors: FieldErrors | null | undefined): boolean {
  return !!errors && Object.keys(errors).length > 0;
}

/** The first message, for a toast or an API response's `message`. */
export function firstError(errors: FieldErrors | null | undefined): string {
  if (!errors) return '';
  const first = Object.values(errors)[0];
  return first || '';
}

/** Field name for one line of a list: lineField('items', 0, 'quantity') is `items.0.quantity`. */
export function lineField(list: string, index: number, field: string): string {
  return `${list}.${index}.${field}`;
}
