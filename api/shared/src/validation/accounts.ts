/**
 * Form validators for signing in, accounts and administration: sign-in and
 * password screens, supplier registration, the staff profile, users,
 * departments, sites and budgets.
 *
 * Built from the helpers in rules.ts; see that file for the conventions.
 */
import { SITE_STATUS, SITE_TYPES } from '../constants/sites.js';
import { USER_ROLE_VALUES } from '../constants/roles.js';
import { USER_STATUS } from '../constants/statuses.js';
import {
  FormErrors,
  TEXT_LIMITS,
  email,
  maxLength,
  money,
  number,
  objectId,
  oneOf,
  password,
  pattern,
  phone,
  required,
  text,
  type FieldErrors
} from './rules.js';

export interface SiteInput {
  code?: unknown;
  name?: unknown;
  type?: unknown;
  status?: unknown;
  address?: { street?: unknown; city?: unknown; province?: unknown; postalCode?: unknown } | null;
}

/** Add or edit a site. The code is set once, so it is only checked when adding. */
export function validateSite(input: SiteInput, { isNew = true }: { isNew?: boolean } = {}): FieldErrors {
  const v = new FormErrors();
  if (isNew) {
    v.add(
      'code',
      required(input.code, 'Enter a site code'),
      pattern(input.code, /^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Use letters, numbers, dashes or underscores only'),
      maxLength(input.code, TEXT_LIMITS.code, 'Code')
    );
  }
  if (isNew || input.name !== undefined) {
    v.add('name', required(input.name, 'Enter the site name'), maxLength(input.name, TEXT_LIMITS.name, 'Name'));
  }
  v.add('type', oneOf(input.type, Object.values(SITE_TYPES), 'Choose HQ or Site'));
  v.add('status', oneOf(input.status, Object.values(SITE_STATUS), 'Choose active or inactive'));
  const address = input.address || {};
  v.add('street', maxLength(address.street, TEXT_LIMITS.short, 'Street'));
  v.add('city', maxLength(address.city, 80, 'City'));
  v.add('province', maxLength(address.province, 80, 'Province'));
  v.add('postalCode', maxLength(address.postalCode, 20, 'Postal code'));
  return v.errors;
}

/** Longest values accepted by the account forms, for the inputs' maxLength. */
export const ACCOUNT_LIMITS = Object.freeze({
  /** A new password. */
  password: 128,
  /**
   * A password being checked rather than set (signing in, the current password).
   * Far above `password`, so a password set before that limit still works.
   */
  existingPassword: 1024,
  otp: 6,
  departmentCode: 10
});

/** Present at all. Passwords are not trimmed, so one made only of spaces still counts. */
function requiredSecret(value: unknown, message: string): string {
  return value === undefined || value === null || value === '' ? message : '';
}

/**
 * Text, not an object or a list. Guards the sign-in and password endpoints,
 * which look accounts up by what arrives.
 */
function textOnly(value: unknown, message: string): string {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' || typeof value === 'number' ? '' : message;
}

/** Exactly the same as the other password; unlike sameAs, spaces count. */
function samePassword(value: unknown, other: unknown, message: string): string {
  if (requiredSecret(value, 'x')) return '';
  return String(value) === String(other ?? '') ? '' : message;
}

export interface LoginInput {
  email?: unknown;
  password?: unknown;
}

/**
 * Sign in. Only presence and length: an account whose address or password
 * predates today's rules must still be able to sign in.
 */
export function validateLogin(input: LoginInput): FieldErrors {
  const v = new FormErrors();
  v.add(
    'email',
    required(input.email, 'Enter your email address'),
    textOnly(input.email, 'Enter your email address'),
    maxLength(input.email, TEXT_LIMITS.email, 'Email')
  );
  v.add(
    'password',
    requiredSecret(input.password, 'Enter your password'),
    textOnly(input.password, 'Enter your password'),
    maxLength(input.password, ACCOUNT_LIMITS.existingPassword, 'Password')
  );
  return v.errors;
}

export interface LoginOtpInput {
  email?: unknown;
  otp?: unknown;
}

/** The six-digit code sent after signing in. */
export function validateLoginOtp(input: LoginOtpInput): FieldErrors {
  const v = new FormErrors();
  v.add(
    'email',
    required(input.email, 'Sign in again to get a new code'),
    textOnly(input.email, 'Sign in again to get a new code'),
    maxLength(input.email, TEXT_LIMITS.email, 'Email')
  );
  v.add(
    'otp',
    required(input.otp, 'Enter the 6-digit code from your email'),
    textOnly(input.otp, 'Enter the 6-digit code from your email'),
    pattern(input.otp, /^\d{6}$/, 'The code is 6 digits')
  );
  return v.errors;
}

/**
 * Ask for a password reset link. Only a loose address check (something@something),
 * so an account with an unusual address can still reset its password.
 */
export function validateForgotPassword(input: { email?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add(
    'email',
    required(input.email, 'Enter your email address'),
    textOnly(input.email, 'Enter your email address'),
    maxLength(input.email, TEXT_LIMITS.email, 'Email'),
    pattern(input.email, /^[^\s@]+@[^\s@]+$/, 'Enter your email address, like name@company.co.zw')
  );
  return v.errors;
}

export interface ResetPasswordInput {
  token?: unknown;
  email?: unknown;
  newPassword?: unknown;
  /** On the screen only; the API is not sent it. */
  confirmPassword?: unknown;
}

/** Set a new password from the emailed link. The token and email come from the link. */
export function validateResetPassword(input: ResetPasswordInput): FieldErrors {
  const v = new FormErrors();
  const broken = 'This reset link is incomplete. Request a new one.';
  v.add(
    'token',
    required(input.token, broken),
    textOnly(input.token, broken),
    pattern(input.token, /^[A-Za-z0-9_-]{1,256}$/, broken)
  );
  v.add(
    'email',
    required(input.email, broken),
    textOnly(input.email, broken),
    maxLength(input.email, TEXT_LIMITS.email, 'Email')
  );
  v.add(
    'newPassword',
    requiredSecret(input.newPassword, 'Enter a new password'),
    textOnly(input.newPassword, 'Enter a new password'),
    password(input.newPassword),
    maxLength(input.newPassword, ACCOUNT_LIMITS.password, 'Password')
  );
  if (input.confirmPassword !== undefined) {
    v.add(
      'confirmPassword',
      requiredSecret(input.confirmPassword, 'Enter the new password again'),
      samePassword(input.confirmPassword, input.newPassword, 'Passwords do not match')
    );
  }
  return v.errors;
}

export interface MyProfileInput {
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
}

/**
 * My profile. The API changes only the fields it is sent, so only those are
 * checked. The email cannot be changed here and is not part of it.
 */
export function validateMyProfile(
  input: MyProfileInput,
  { currentPhone }: { currentPhone?: string | null } = {}
): FieldErrors {
  const v = new FormErrors();
  if (input.firstName !== undefined) {
    v.add(
      'firstName',
      required(input.firstName, 'Enter your first name'),
      maxLength(input.firstName, TEXT_LIMITS.name, 'First name')
    );
  }
  if (input.lastName !== undefined) {
    v.add(
      'lastName',
      required(input.lastName, 'Enter your last name'),
      maxLength(input.lastName, TEXT_LIMITS.name, 'Last name')
    );
  }
  v.add('phone', unchangedPhone(input.phone, currentPhone) ? '' : phone(input.phone), maxLength(input.phone, TEXT_LIMITS.phone, 'Phone'));
  return v.errors;
}

/**
 * A phone number saved before these checks may not match the format. Leaving
 * it as it is must not stop the rest of a record from being saved.
 */
function unchangedPhone(value: unknown, current?: string | null): boolean {
  return current !== undefined && current !== null && text(value) === text(current);
}

export interface ChangePasswordInput {
  currentPassword?: unknown;
  newPassword?: unknown;
  /** On the screen only; the API is not sent it. */
  confirmPassword?: unknown;
}

/** Change my password from the profile page. */
export function validateChangePassword(input: ChangePasswordInput): FieldErrors {
  const v = new FormErrors();
  v.add(
    'currentPassword',
    requiredSecret(input.currentPassword, 'Enter your current password'),
    textOnly(input.currentPassword, 'Enter your current password'),
    maxLength(input.currentPassword, ACCOUNT_LIMITS.existingPassword, 'Current password')
  );
  v.add(
    'newPassword',
    requiredSecret(input.newPassword, 'Enter a new password'),
    textOnly(input.newPassword, 'Enter a new password'),
    password(input.newPassword, 'New password'),
    maxLength(input.newPassword, ACCOUNT_LIMITS.password, 'New password')
  );
  if (input.confirmPassword !== undefined) {
    v.add(
      'confirmPassword',
      requiredSecret(input.confirmPassword, 'Enter the new password again'),
      samePassword(input.confirmPassword, input.newPassword, 'Passwords do not match')
    );
  }
  return v.errors;
}

export interface StaffUserInput {
  email?: unknown;
  password?: unknown;
  /** On the screen only; the API is not sent it. */
  confirmPassword?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  role?: unknown;
  department?: unknown;
  homeSite?: unknown;
  phone?: unknown;
  status?: unknown;
}

/**
 * Add or edit a staff user. The email is set once, so it is only checked when
 * adding. A password is required when adding; when editing, a blank one keeps
 * the current password.
 */
export function validateStaffUser(
  input: StaffUserInput,
  { isNew = true, currentPhone }: { isNew?: boolean; currentPhone?: string | null } = {}
): FieldErrors {
  const v = new FormErrors();
  if (isNew) {
    v.add('email', required(input.email, "Enter the user's email address"), email(input.email));
  }
  if (isNew || input.firstName !== undefined) {
    v.add('firstName', required(input.firstName, 'Enter the first name'), maxLength(input.firstName, TEXT_LIMITS.name, 'First name'));
  }
  if (isNew || input.lastName !== undefined) {
    v.add('lastName', required(input.lastName, 'Enter the last name'), maxLength(input.lastName, TEXT_LIMITS.name, 'Last name'));
  }
  v.add(
    'password',
    isNew ? requiredSecret(input.password, 'Enter a password') : '',
    textOnly(input.password, 'Enter a password'),
    password(input.password),
    maxLength(input.password, ACCOUNT_LIMITS.password, 'Password')
  );
  if (input.confirmPassword !== undefined && !requiredSecret(input.password, 'x')) {
    v.add(
      'confirmPassword',
      requiredSecret(input.confirmPassword, 'Enter the password again'),
      samePassword(input.confirmPassword, input.password, 'Passwords do not match')
    );
  }
  v.add(
    'role',
    isNew || input.role !== undefined ? required(input.role, 'Choose a role') : '',
    oneOf(input.role, USER_ROLE_VALUES, 'Choose a role from the list')
  );
  v.add('department', objectId(input.department, 'Choose a department from the list'));
  v.add('homeSite', objectId(input.homeSite, 'Choose a site from the list'));
  v.add('phone', !isNew && unchangedPhone(input.phone, currentPhone) ? '' : phone(input.phone), maxLength(input.phone, TEXT_LIMITS.phone, 'Phone'));
  v.add('status', oneOf(input.status, Object.values(USER_STATUS), 'Choose active, inactive or suspended'));
  return v.errors;
}

export interface DepartmentInput {
  name?: unknown;
  code?: unknown;
  description?: unknown;
  head?: unknown;
  deputyHead?: unknown;
  status?: unknown;
}

/**
 * Add or edit a department. The code is optional. When editing, a code left as
 * it was is not checked again, so a department set up before these rules can
 * still be saved.
 */
export function validateDepartment(
  input: DepartmentInput,
  { isNew = true, currentCode }: { isNew?: boolean; currentCode?: string | null } = {}
): FieldErrors {
  const v = new FormErrors();
  if (isNew || input.name !== undefined) {
    v.add('name', required(input.name, 'Enter the department name'), maxLength(input.name, TEXT_LIMITS.name, 'Name'));
  }
  const unchangedCode = !isNew && !!currentCode && text(input.code).toUpperCase() === text(currentCode).toUpperCase();
  if (!unchangedCode) {
    v.add(
      'code',
      pattern(input.code, /^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Use letters, numbers, dashes or underscores only'),
      maxLength(input.code, ACCOUNT_LIMITS.departmentCode, 'Code')
    );
  }
  v.add('description', maxLength(input.description, TEXT_LIMITS.long, 'Description'));
  v.add('head', objectId(input.head, 'Choose a department head from the list'));
  v.add('deputyHead', objectId(input.deputyHead, 'Choose a deputy HOD from the list'));
  v.add('status', oneOf(input.status, ['active', 'inactive'], 'Choose active or inactive'));
  return v.errors;
}

export interface DepartmentBudgetInput {
  departmentId?: unknown;
  fiscalYear?: unknown;
  allocatedAmount?: unknown;
  notes?: unknown;
}

/** Set a department's budget for a fiscal year. A blank year means this year. */
export function validateDepartmentBudget(input: DepartmentBudgetInput): FieldErrors {
  const v = new FormErrors();
  v.add(
    'departmentId',
    required(input.departmentId, 'Choose a department'),
    objectId(input.departmentId, 'Choose a department from the list')
  );
  v.add('fiscalYear', number(input.fiscalYear, { label: 'Fiscal year', integer: true, min: 2000, max: 2100 }));
  v.add(
    'allocatedAmount',
    required(input.allocatedAmount, 'Enter the allocated amount'),
    money(input.allocatedAmount, 'Allocated amount')
  );
  v.add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Notes'));
  return v.errors;
}
