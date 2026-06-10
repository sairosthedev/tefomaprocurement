export const SITE_TYPES = Object.freeze({
  HQ: 'hq',
  SITE: 'site'
} as const);

export type SiteType = (typeof SITE_TYPES)[keyof typeof SITE_TYPES];

export const SITE_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const);

export type SiteStatus = (typeof SITE_STATUS)[keyof typeof SITE_STATUS];

export const STOCK_TRANSFER_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  IN_TRANSIT: 'in_transit',
  RECEIVED: 'received',
  PARTIALLY_RECEIVED: 'partially_received',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected'
} as const);

export type StockTransferStatus =
  (typeof STOCK_TRANSFER_STATUS)[keyof typeof STOCK_TRANSFER_STATUS];
