export const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  PROCUREMENT_OFFICER: 'procurement_officer',
  DEPARTMENT_HEAD: 'department_head',
  END_USER: 'end_user',
  FINANCE: 'finance',
  COO: 'coo',
  STORES_OFFICER: 'stores_officer',
  SUPPLIER: 'supplier'
} as const);

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_VALUES: readonly UserRole[] = Object.freeze(
  Object.values(USER_ROLES)
);

export interface RoleOption {
  value: UserRole;
  label: string;
}

export const USER_ROLE_OPTIONS: readonly RoleOption[] = Object.freeze([
  { value: USER_ROLES.ADMIN, label: 'System Administrator' },
  { value: USER_ROLES.PROCUREMENT_OFFICER, label: 'Procurement Officer' },
  { value: USER_ROLES.DEPARTMENT_HEAD, label: 'Department Head' },
  { value: USER_ROLES.END_USER, label: 'End User' },
  { value: USER_ROLES.FINANCE, label: 'Finance Manager' },
  { value: USER_ROLES.COO, label: 'Chief Operating Officer' },
  { value: USER_ROLES.STORES_OFFICER, label: 'Stores Officer' },
  { value: USER_ROLES.SUPPLIER, label: 'Supplier' }
]);

/**
 * Recognised identifiers for the Procurement department. A department_head
 * whose department matches one of these is treated as the head of procurement
 * (a.k.a. Procurement Manager) and is granted procurement capabilities,
 * including authorizing quotations for acceptance.
 */
export const PROCUREMENT_DEPARTMENT_CODES: readonly string[] = Object.freeze([
  'PROC',
  'PROCUREMENT'
]);

/**
 * Returns true if the given department (by code or name) is the Procurement
 * department. Accepts a populated department object or a plain string.
 */
export function isProcurementDepartment(
  department: { code?: string | null; name?: string | null } | string | null | undefined
): boolean {
  if (!department) return false;
  if (typeof department === 'string') {
    return /procurement|^proc$/i.test(department.trim());
  }
  const code = (department.code || '').trim().toUpperCase();
  if (code && PROCUREMENT_DEPARTMENT_CODES.includes(code)) return true;
  const name = (department.name || '').trim();
  return /procurement/i.test(name);
}

/**
 * True when a user is the head of the Procurement department: a department_head
 * whose department is Procurement. Such a user gets procurement_officer-level
 * access and is the designated quotation authorizer.
 */
export function isProcurementHead(
  user: { role?: string | null; department?: any } | null | undefined
): boolean {
  if (!user || user.role !== USER_ROLES.DEPARTMENT_HEAD) return false;
  return isProcurementDepartment(user.department);
}
