'use strict';

const SITE_TYPES = Object.freeze({
  HQ: 'hq',
  SITE: 'site'
});

const SITE_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive'
});

const STOCK_TRANSFER_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  IN_TRANSIT: 'in_transit',
  RECEIVED: 'received',
  PARTIALLY_RECEIVED: 'partially_received',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected'
});

module.exports = { SITE_TYPES, SITE_STATUS, STOCK_TRANSFER_STATUS };
