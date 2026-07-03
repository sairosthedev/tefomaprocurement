export const PR_CANCELLATION_REASONS = [
  { code: 'no_longer_required', label: 'No longer required' },
  { code: 'duplicate_request', label: 'Duplicate request' },
  { code: 'budget_unavailable', label: 'Budget no longer available' },
  { code: 'specification_changed', label: 'Specification changed — will re-raise' },
  { code: 'sourced_elsewhere', label: 'Sourced elsewhere / fulfilled manually' },
  { code: 'project_cancelled', label: 'Project or work order cancelled' },
  { code: 'other', label: 'Other (explain below)' }
] as const;

export const PO_CANCELLATION_REASONS = [
  { code: 'supplier_unable', label: 'Supplier unable to deliver' },
  { code: 'price_changed', label: 'Price or terms changed' },
  { code: 'no_longer_required', label: 'Goods no longer required' },
  { code: 'duplicate_po', label: 'Duplicate purchase order' },
  { code: 'requisition_cancelled', label: 'Linked requisition cancelled' },
  { code: 'supplier_default', label: 'Supplier default / contract ended' },
  { code: 'other', label: 'Other (explain below)' }
] as const;

export type PrCancellationReasonCode = (typeof PR_CANCELLATION_REASONS)[number]['code'];
export type PoCancellationReasonCode = (typeof PO_CANCELLATION_REASONS)[number]['code'];

/** PR statuses that can never be cancelled. */
export const PR_TERMINAL_STATUSES = ['fulfilled', 'completed', 'cancelled', 'rejected'] as const;

/** PO statuses that can never be cancelled. */
export const PO_TERMINAL_STATUSES = ['cancelled', 'completed', 'partially_received', 'issued'] as const;

/** PR statuses each role may cancel (subject to ownership / department checks). */
export const PR_CANCEL_BY_ROLE: Record<string, readonly string[]> = {
  end_user: ['draft', 'pending_hod'],
  department_head: ['draft', 'pending_hod', 'stores_review'],
  procurement_officer: ['pending_acceptance', 'accepted', 'sourcing', 'quoted', 'ordered'],
  admin: [
    'draft',
    'pending_hod',
    'stores_review',
    'pending_acceptance',
    'accepted',
    'sourcing',
    'quoted',
    'ordered'
  ]
};

/** PO statuses each role may cancel (subject to invoice/delivery checks). */
export const PO_CANCEL_BY_ROLE: Record<string, readonly string[]> = {
  procurement_officer: ['draft', 'pending_hod', 'pending_finance', 'pending_coo', 'pending_approvals', 'rejected', 'approved'],
  finance: ['pending_finance', 'pending_approvals', 'approved'],
  coo: ['pending_coo'],
  admin: ['draft', 'pending_hod', 'pending_finance', 'pending_coo', 'pending_approvals', 'rejected', 'approved']
};

export function isValidPrCancellationReason(code: string): boolean {
  return PR_CANCELLATION_REASONS.some((r) => r.code === code);
}

export function isValidPoCancellationReason(code: string): boolean {
  return PO_CANCELLATION_REASONS.some((r) => r.code === code);
}

export function getPrCancellationReasonLabel(code: string): string {
  return PR_CANCELLATION_REASONS.find((r) => r.code === code)?.label || code;
}

export function getPoCancellationReasonLabel(code: string): string {
  return PO_CANCELLATION_REASONS.find((r) => r.code === code)?.label || code;
}
