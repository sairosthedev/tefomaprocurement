export const REQUISITION_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONVERTED: 'converted'
} as const);

export type RequisitionStatus =
  (typeof REQUISITION_STATUS)[keyof typeof REQUISITION_STATUS];

export const RFQ_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
} as const);

export type RfqStatus = (typeof RFQ_STATUS)[keyof typeof RFQ_STATUS];

export const QUOTATION_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected'
} as const);

export type QuotationStatus =
  (typeof QUOTATION_STATUS)[keyof typeof QUOTATION_STATUS];

export const PURCHASE_ORDER_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_FINANCE: 'pending_finance',
  PENDING_COO: 'pending_coo',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DELIVERED: 'delivered',
  CLOSED: 'closed'
} as const);

export type PurchaseOrderStatus =
  (typeof PURCHASE_ORDER_STATUS)[keyof typeof PURCHASE_ORDER_STATUS];

export const DELIVERY_STATUS = Object.freeze({
  PENDING: 'pending',
  PARTIAL: 'partial',
  COMPLETE: 'complete'
} as const);

export type DeliveryStatus =
  (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended'
} as const);

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const SUPPLIER_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  BLACKLISTED: 'blacklisted'
} as const);

export type SupplierStatus =
  (typeof SUPPLIER_STATUS)[keyof typeof SUPPLIER_STATUS];
