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
