import {
  SUPPLIER_BUSINESS_TYPES,
  SUPPLIER_ENTITY_TYPES,
  type SupplierBusinessType,
  type SupplierEntityType
} from '../models/SupplierProfile.model.js';

/**
 * Business type and entity type: two optional descriptions of a supplier,
 * read the same way on every path that writes them (registration, Add
 * Supplier, bulk import, the procurement editor and the supplier's own
 * profile).
 *
 * Values are matched ignoring case, spaces and hyphens, so "Service Provider"
 * from a spreadsheet is `service_provider`. Anything else is refused with a
 * message naming the accepted values, rather than reaching the schema and
 * failing as a validation error on save.
 */

const normalise = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const label = (values: readonly string[]) => values.join(', ');

/**
 * `undefined` when the field was not sent (leave it as it is), `null` when it
 * was sent empty (clear it), otherwise the canonical value.
 */
type Parsed<T> = { value: T | null | undefined; error?: string };

function parseOne<T extends string>(raw: unknown, allowed: readonly T[], name: string): Parsed<T> {
  if (raw === undefined) return { value: undefined };
  if (raw === null || normalise(raw) === '') return { value: null };
  const value = normalise(raw) as T;
  if (!allowed.includes(value)) {
    return { value: undefined, error: `Unknown ${name} "${String(raw).trim()}". Use one of: ${label(allowed)}` };
  }
  return { value };
}

export interface SupplierClassification {
  businessType?: SupplierBusinessType | null;
  entityType?: SupplierEntityType | null;
  /** The first problem found, phrased for an API error or an import row. */
  error?: string;
}

export function readSupplierClassification(source: any): SupplierClassification {
  const business = parseOne(source?.businessType, SUPPLIER_BUSINESS_TYPES, 'business type');
  const entity = parseOne(source?.entityType, SUPPLIER_ENTITY_TYPES, 'entity type');
  return {
    businessType: business.value,
    entityType: entity.value,
    error: business.error || entity.error
  };
}

/**
 * Write parsed values onto a supplier: a field not sent is left alone, one
 * sent empty is cleared.
 */
export function applySupplierClassification(supplier: any, parsed: SupplierClassification): void {
  if (parsed.businessType !== undefined) supplier.businessType = parsed.businessType ?? undefined;
  if (parsed.entityType !== undefined) supplier.entityType = parsed.entityType ?? undefined;
}

/** The parsed values as creation fields, leaving out anything not given. */
export function classificationFields(parsed: SupplierClassification): {
  businessType?: SupplierBusinessType;
  entityType?: SupplierEntityType;
} {
  return {
    ...(parsed.businessType ? { businessType: parsed.businessType } : {}),
    ...(parsed.entityType ? { entityType: parsed.entityType } : {})
  };
}
