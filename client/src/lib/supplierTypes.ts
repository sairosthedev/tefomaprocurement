/**
 * Supplier descriptions and onboarding state, as the API stores them.
 * Kept in step with SUPPLIER_BUSINESS_TYPES / SUPPLIER_ENTITY_TYPES in
 * api/src/models/SupplierProfile.model.ts, which validates them.
 */

export const BUSINESS_TYPE_OPTIONS = [
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'wholesaler', label: 'Wholesaler' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'service_provider', label: 'Service provider' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'other', label: 'Other' }
] as const;

export const ENTITY_TYPE_OPTIONS = [
  { value: 'company', label: 'Company' },
  { value: 'individual', label: 'Individual / sole trader' }
] as const;

export const businessTypeLabel = (value?: string | null): string =>
  BUSINESS_TYPE_OPTIONS.find((o) => o.value === value)?.label || '';

export const entityTypeLabel = (value?: string | null): string =>
  ENTITY_TYPE_OPTIONS.find((o) => o.value === value)?.label || '';

/** Pending, and submitted for activation: waiting on the Head of Procurement or the COO. */
export const isAwaitingActivation = (supplier: any): boolean =>
  supplier?.status === 'pending' && !!supplier?.activationRequest?.requestedBy;

/** The status as a person reads it, including the awaiting-approval state. */
export function supplierStatusLabel(supplier: any): string {
  if (isAwaitingActivation(supplier)) return 'Awaiting approval';
  const status = String(supplier?.status || '');
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
}
