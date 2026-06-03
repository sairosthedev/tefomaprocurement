'use strict';

const REQUISITION_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONVERTED: 'converted'
});

const RFQ_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});

const QUOTATION_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected'
});

const PURCHASE_ORDER_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_FINANCE: 'pending_finance',
  PENDING_COO: 'pending_coo',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DELIVERED: 'delivered',
  CLOSED: 'closed'
});

const DELIVERY_STATUS = Object.freeze({
  PENDING: 'pending',
  PARTIAL: 'partial',
  COMPLETE: 'complete'
});

const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended'
});

const SUPPLIER_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  BLACKLISTED: 'blacklisted'
});

module.exports = {
  REQUISITION_STATUS,
  RFQ_STATUS,
  QUOTATION_STATUS,
  PURCHASE_ORDER_STATUS,
  DELIVERY_STATUS,
  USER_STATUS,
  SUPPLIER_STATUS
};
