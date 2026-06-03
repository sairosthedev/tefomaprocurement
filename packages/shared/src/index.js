'use strict';

// NOTE: explicit named-property assignments (no `...spread`) so Rollup's
// CommonJS interop can statically detect every export. Without this, the
// client build fails with `"X" is not exported by ...`.

const {
  USER_ROLES,
  USER_ROLE_VALUES,
  USER_ROLE_OPTIONS
} = require('./constants/roles');

const {
  CURRENCIES,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCY_CODES,
  formatCurrency
} = require('./constants/currencies');

const {
  REQUISITION_STATUS,
  RFQ_STATUS,
  QUOTATION_STATUS,
  PURCHASE_ORDER_STATUS,
  DELIVERY_STATUS,
  USER_STATUS,
  SUPPLIER_STATUS
} = require('./constants/statuses');

const { PROVINCES, BANKS, ACCOUNT_TYPES } = require('./constants/regions');

const {
  SUPPLIER_CATEGORIES,
  UNITS_OF_MEASUREMENT,
  UNIT_OPTIONS
} = require('./constants/catalog');

const { SITE_TYPES, SITE_STATUS, STOCK_TRANSFER_STATUS } = require('./constants/sites');

module.exports = {
  USER_ROLES,
  USER_ROLE_VALUES,
  USER_ROLE_OPTIONS,
  CURRENCIES,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCY_CODES,
  formatCurrency,
  REQUISITION_STATUS,
  RFQ_STATUS,
  QUOTATION_STATUS,
  PURCHASE_ORDER_STATUS,
  DELIVERY_STATUS,
  USER_STATUS,
  SUPPLIER_STATUS,
  PROVINCES,
  BANKS,
  ACCOUNT_TYPES,
  SUPPLIER_CATEGORIES,
  UNITS_OF_MEASUREMENT,
  UNIT_OPTIONS,
  SITE_TYPES,
  SITE_STATUS,
  STOCK_TRANSFER_STATUS
};
