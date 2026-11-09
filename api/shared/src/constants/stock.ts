import { isValidCategoryCode, SUPPLIER_CATEGORY_LIST } from './supplierCategories.js';
import { mapLegacyCategory } from './legacyCategoryMap.js';

/**
 * One definition of "low" and "out of stock", used by the inventory page, the
 * dashboards, the reports and the hourly alert alike. Before this each used its
 * own rule, so the same store showed three different low-stock counts.
 */

/** Reorder level assumed for an item nobody has set one for. */
export const DEFAULT_REORDER_LEVEL = 5;

/** Days of issues looked at when suggesting levels from usage. */
export const USAGE_WINDOW_DAYS = 90;

export type ReorderLevelSource = 'site' | 'item' | 'default';
export type StockStatus = 'out' | 'low' | 'ok';

/**
 * The reorder level that applies to one item at one site: the site's own
 * level when set (zero included), else the catalogue item's when above zero,
 * else the default.
 */
export function effectiveReorderLevel(
  siteLevel?: number | null,
  itemLevel?: number | null
): { level: number; source: ReorderLevelSource } {
  if (typeof siteLevel === 'number' && siteLevel >= 0) return { level: siteLevel, source: 'site' };
  if (typeof itemLevel === 'number' && itemLevel > 0) return { level: itemLevel, source: 'item' };
  return { level: DEFAULT_REORDER_LEVEL, source: 'default' };
}

/** Out when nothing is on hand; low at or below the reorder level; otherwise ok. */
export function stockStatus(onHand: number, level: number): StockStatus {
  if ((onHand || 0) <= 0) return 'out';
  if (onHand <= level) return 'low';
  return 'ok';
}

/**
 * How much to restock: the site's reorder quantity when set, otherwise enough
 * to bring stock up to twice the reorder level. Never less than one.
 */
export function suggestedRestockQuantity(onHand: number, level: number, reorderQuantity?: number | null): number {
  if (typeof reorderQuantity === 'number' && reorderQuantity > 0) return reorderQuantity;
  return Math.max(1, Math.ceil(2 * level - (onHand || 0)));
}

/**
 * Stock categories, as items are filed in the catalogue, mapped to the
 * supplier category procurement invites suppliers by. The two lists grew
 * apart ("Construction Materials" in stores, "Construction Materials &
 * Aggregates" for suppliers), which made a restock ask for a category the
 * item already had. Keys are upper-cased. Values with no clear single trade
 * ("Consumables", "General") are left out on purpose, as in the legacy map:
 * a wrong guess invites the wrong suppliers.
 */
export const STOCK_CATEGORY_MAP: Readonly<Record<string, string>> = Object.freeze({
  'CONSTRUCTION MATERIALS': 'BUILD-MAT',
  'ICT HARDWARE': 'ICT-HW',
  'IT EQUIPMENT & SERVICES': 'ICT-HW',
  'PIPES & FITTINGS': 'BUILD-PIPE',
  'PLUMBING MATERIALS': 'BUILD-PIPE',
  'PLANT SPARES': 'IND-MAINT',
  'PROTECTIVE CLOTHING': 'SEC-PROTECT',
  'SAFETY': 'SEC-PROTECT',
  'SAFETY EQUIPMENT': 'SEC-PROTECT',
  'STATIONERY': 'OFF-STAT',
  'OFFICE SUPPLIES': 'OFF-STAT',
  'TIMBER': 'BUILD-TIMBER',
  'TOOLS': 'IND-TOOLS',
  'ELECTRICAL SUPPLIES': 'ELEC-SUPPLY',
  'FURNITURE': 'OFF-FURN',
  'CLEANING SUPPLIES': 'CHEM-CLEAN',
  'MINING EQUIPMENT': 'IND-MINE',
  'MEDICAL SUPPLIES': 'MED-DRUG'
});

/**
 * The supplier category for an item's catalogue category, or '' when it
 * cannot be told: a code already; the stock map; a supplier category of the
 * same name; or an old supplier name that maps to exactly one code.
 */
export function categoryCodeForStock(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isValidCategoryCode(raw)) return raw;
  const key = raw.replace(/\s+/g, ' ').toUpperCase();
  if (STOCK_CATEGORY_MAP[key]) return STOCK_CATEGORY_MAP[key];
  const byName = SUPPLIER_CATEGORY_LIST.find((c) => c.name.replace(/\s+/g, ' ').toUpperCase() === key);
  if (byName) return byName.code;
  const legacy = mapLegacyCategory(raw);
  return legacy.length === 1 ? legacy[0] : '';
}
