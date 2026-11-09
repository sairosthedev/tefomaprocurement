import { DEFAULT_REORDER_LEVEL } from '@fossil/shared';
import { Inventory } from '../models/index.js';

/**
 * The Mongo side of the shared stock rules (`effectiveReorderLevel`,
 * `stockStatus`), for aggregations over Inventory joined to its Item as
 * `itemDoc`. Every count of low stock goes through these, so the inventory
 * page, the dashboards, the reports and the alert agree.
 */
const DEFAULT_LEVEL = parseInt(process.env.LOW_STOCK_DEFAULT_THRESHOLD || String(DEFAULT_REORDER_LEVEL), 10);

/** The site's level when set, else the item's when above zero, else the default. */
export const effectiveLevelExpr = {
  $ifNull: [
    '$reorderLevel',
    { $cond: [{ $gt: [{ $ifNull: ['$itemDoc.reorderLevel', 0] }, 0] }, '$itemDoc.reorderLevel', DEFAULT_LEVEL] }
  ]
};

/** Where the level came from, for showing "default" next to an unset one. */
export const levelSourceExpr = {
  $cond: [
    { $ne: [{ $ifNull: ['$reorderLevel', null] }, null] },
    'site',
    { $cond: [{ $gt: [{ $ifNull: ['$itemDoc.reorderLevel', 0] }, 0] }, 'item', 'default'] }
  ]
};

/** At or below the reorder level, empty shelves included. */
export const isLowExpr = { $lte: ['$quantityOnHand', effectiveLevelExpr] };

/** Nothing on hand. */
export const isOutExpr = { $lte: ['$quantityOnHand', 0] };

/** Stock rows joined to their live catalogue item, before any low-stock test. */
export function withLiveItem(match: Record<string, unknown> = {}): any[] {
  return [
    { $match: { isDeleted: false, ...match } },
    { $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'itemDoc' } },
    { $unwind: '$itemDoc' },
    { $match: { 'itemDoc.isDeleted': false, 'itemDoc.status': 'active' } }
  ];
}

/** How many stock rows are low, and how many of those are empty. */
export async function countLowStock(match: Record<string, unknown> = {}): Promise<{ low: number; out: number }> {
  const [row] = await Inventory.aggregate([
    ...withLiveItem(match),
    { $match: { $expr: isLowExpr } },
    { $group: { _id: null, low: { $sum: 1 }, out: { $sum: { $cond: [isOutExpr, 1, 0] } } } }
  ]);
  return { low: row?.low || 0, out: row?.out || 0 };
}
