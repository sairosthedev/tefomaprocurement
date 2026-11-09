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
