import type { Request, Response } from 'express';
import { Inventory, PurchaseRequisition } from '../../models/index.js';
import { suggestAction } from '../../services/inventoryAvailability.service.js';

// The queue shows counts and stock state per line, not the lines' photos, and
// not the approval history; both can be large and are on the requisition page.
const QUEUE_EXCLUDE = '-items.attachments -statusHistory';

const idOf = (value: any): string => (value?._id ?? value).toString();

/**
 * Stock on hand for every line of the page's requisitions, from one inventory
 * query instead of one per line. Same rule as checkItemAvailability: rows with
 * stock, less what is reserved, split between the requisition's site and the
 * rest.
 */
async function stockByItem(itemIds: any[]): Promise<Map<string, { site: string; available: number }[]>> {
  const byItem = new Map<string, { site: string; available: number }[]>();
  if (itemIds.length === 0) return byItem;

  const rows = await Inventory.find({
    item: { $in: itemIds },
    isDeleted: false,
    quantityOnHand: { $gt: 0 }
  })
    .select('item site quantityOnHand quantityReserved')
    .lean();

  for (const row of rows as any[]) {
    const key = row.item.toString();
    if (!byItem.has(key)) byItem.set(key, []);
    byItem.get(key)!.push({ site: row.site.toString(), available: row.quantityOnHand - (row.quantityReserved || 0) });
  }
  return byItem;
}

function withAvailability(items: any[], siteId: string, stock: Map<string, { site: string; available: number }[]>): any[] {
  return items.map((line: any) => {
    if (!line.item) return line;

    let atSite = 0;
    let elsewhere = 0;
    for (const row of stock.get(line.item.toString()) || []) {
      if (row.site === siteId) atSite += row.available;
      else elsewhere += row.available;
    }
    const total = atSite + elsewhere;
    const needed = line.quantity || 1;
    const suggestion = suggestAction(needed, { atSite, elsewhere });

    return {
      ...line.toObject?.() || line,
      storeAvailability: {
        available: total >= needed,
        quantityAvailable: total,
        quantityAtSite: suggestion.quantityAtSite,
        quantityAtOtherSites: suggestion.quantityAtOtherSites,
        suggestedAction: suggestion.suggestedAction,
        checkedAt: new Date()
      }
    };
  });
}

const getPendingPurchaseRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { page = 1, limit = 20 } = req.query as Record<string, any>;
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter = { status: 'stores_review', isDeleted: false };

    const [total, requisitions] = await Promise.all([
      PurchaseRequisition.countDocuments(filter),
      PurchaseRequisition.find(filter)
        .select(QUEUE_EXCLUDE)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    // Who raised each one and the stock for every line, at once.
    const itemIds = requisitions.flatMap((pr) => (pr.items || []).map((line: any) => line.item).filter(Boolean));
    const [, stock] = await Promise.all([
      PurchaseRequisition.populate(requisitions, [
        { path: 'requestedBy', select: 'firstName lastName email' },
        { path: 'department', select: 'name code' },
        { path: 'site', select: 'code name' }
      ]),
      stockByItem(itemIds)
    ]);

    const data = requisitions.map((pr) => {
      const obj = pr.toObject();
      if (pr.site) {
        obj.items = withAvailability(pr.items as any[], idOf(pr.site), stock);
      }
      return obj;
    });

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('Get stores PR queue error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPendingPurchaseRequisitions;
