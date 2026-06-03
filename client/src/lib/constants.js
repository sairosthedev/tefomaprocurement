import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  formatCurrency,
  PROVINCES,
  BANKS,
  ACCOUNT_TYPES,
  SUPPLIER_CATEGORIES,
  UNITS_OF_MEASUREMENT,
  UNIT_OPTIONS,
  USER_ROLE_OPTIONS
} from '@fosssil/shared';

export {
  CURRENCIES,
  DEFAULT_CURRENCY,
  formatCurrency,
  PROVINCES,
  BANKS,
  ACCOUNT_TYPES,
  SUPPLIER_CATEGORIES,
  UNITS_OF_MEASUREMENT,
  UNIT_OPTIONS
};

// Back-compat aliases (lowercase names previously exported from this module).
// Keep these so pages don't need to change in this refactor.
export const currencies = CURRENCIES;
export const defaultCurrency = DEFAULT_CURRENCY;
export const provinces = PROVINCES;
export const banks = BANKS;
export const accountTypes = ACCOUNT_TYPES;
export const supplierCategories = SUPPLIER_CATEGORIES;
export const units = UNIT_OPTIONS;
export const USER_ROLES = USER_ROLE_OPTIONS;
