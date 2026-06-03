'use strict';

const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  PROCUREMENT_OFFICER: 'procurement_officer',
  DEPARTMENT_HEAD: 'department_head',
  FINANCE: 'finance',
  COO: 'coo',
  STORES_OFFICER: 'stores_officer',
  SUPPLIER: 'supplier'
});

const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));

const USER_ROLE_OPTIONS = Object.freeze([
  { value: USER_ROLES.ADMIN, label: 'System Administrator' },
  { value: USER_ROLES.PROCUREMENT_OFFICER, label: 'Procurement Officer' },
  { value: USER_ROLES.DEPARTMENT_HEAD, label: 'Department Head' },
  { value: USER_ROLES.FINANCE, label: 'Finance Manager' },
  { value: USER_ROLES.COO, label: 'Chief Operating Officer' },
  { value: USER_ROLES.STORES_OFFICER, label: 'Stores Officer' },
  { value: USER_ROLES.SUPPLIER, label: 'Supplier' }
]);

module.exports = { USER_ROLES, USER_ROLE_VALUES, USER_ROLE_OPTIONS };
