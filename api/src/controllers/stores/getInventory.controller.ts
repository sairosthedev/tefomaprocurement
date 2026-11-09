import type { Request, Response } from 'express';

import { PR_TERMINAL_STATUSES } from '@fossil/shared';
import { Inventory, PurchaseRequisition } from '../../models/index.js';
import { buildSiteFilterAsync } from '../../lib/siteScope.js';
import { escapeRegex } from '../../lib/regex.js';
import { effectiveLevelExpr, isLowExpr, isOutExpr, levelSourceExpr } from '../../lib/stockLevels.js';

const getInventory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { search, category, belowReorderLevel, lowStock, outOfStock, site, page = 1, limit = 50 } =
      req.query as Record<string, any>;

    let siteFilter: Record<string, unknown> = {};
    try {
      siteFilter = await buildSiteFilterAsync(req.user, site);
    } catch (err: any) {
      return res.status(err.statusCode || 403).json({ success: false, message: err.message });
    }

    const filterLowStock = belowReorderLevel === 'true' || lowStock === 'true';
    const filterOutOfStock = outOfStock === 'true';
    const skip = (Number(page) - 1) * Number(limit);
    const pageLimit = parseInt(limit, 10);

    const itemMatch: Record<string, unknown> = { 'itemDoc.isDeleted': false };
    const searchText = typeof search === 'string' ? search.trim() : '';
    if (searchText) {
      const pattern = escapeRegex(searchText);
      itemMatch.$or = [
        { 'itemDoc.name': { $regex: pattern, $options: 'i' } },
        { 'itemDoc.code': { $regex: pattern, $options: 'i' } },
        { 'itemDoc.description': { $regex: pattern, $options: 'i' } }
      ];
    }
    if (category) {
      itemMatch['itemDoc.category'] = category;
    }

    const baseStages: any[] = [
      { $match: { isDeleted: false, ...siteFilter } },
      {
        $lookup: {
          from: 'items',
          localField: 'item',
          foreignField: '_id',
          as: 'itemDoc'
        }
      },
      { $unwind: '$itemDoc' },
      { $match: itemMatch }
    ];

    // The shared rule: the site's level, else the item's, else the default.
    if (filterLowStock) {
      baseStages.push({ $match: { $expr: isLowExpr } });
    }
    if (filterOutOfStock) {
      baseStages.push({ $match: { $expr: isOutExpr } });
    }

    const [result] = await Inventory.aggregate([
      ...baseStages,
      {
        $facet: {
          stats: [
            {
              $group: {
                _id: null,
                totalItems: { $sum: 1 },
                totalStockValue: {
                  $sum: {
                    $multiply: [
                      '$quantityOnHand',
                      { $ifNull: ['$unitCost', 0] }
                    ]
                  }
                },
                categories: { $addToSet: '$itemDoc.category' }
              }
            },
            {
              $project: {
                _id: 0,
                totalItems: 1,
                totalStockValue: 1,
                categoryCount: {
                  $size: {
                    $filter: {
                      input: '$categories',
                      as: 'cat',
                      cond: { $and: [{ $ne: ['$$cat', null] }, { $ne: ['$$cat', ''] }] }
                    }
                  }
                }
              }
            }
          ],
          lowStock: [
            { $match: { $expr: isLowExpr } },
            { $group: { _id: null, count: { $sum: 1 }, out: { $sum: { $cond: [isOutExpr, 1, 0] } } } }
          ],
          totalCount: [{ $count: 'count' }],
          data: [
            { $sort: { 'itemDoc.name': 1 } },
            { $skip: skip },
            { $limit: pageLimit },
            {
              $lookup: {
                from: 'sites',
                localField: 'site',
                foreignField: '_id',
                as: 'siteDoc'
              }
            },
            { $unwind: { path: '$siteDoc', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                quantityOnHand: 1,
                quantityReserved: 1,
                quantityAvailable: 1,
                reorderLevel: 1,
                reorderQuantity: 1,
                effectiveReorderLevel: effectiveLevelExpr,
                reorderLevelSource: levelSourceExpr,
                location: 1,
                unitCost: 1,
                totalValue: 1,
                lastReceivedDate: 1,
                lastIssuedDate: 1,
                createdAt: 1,
                updatedAt: 1,
                site: {
                  _id: '$siteDoc._id',
                  code: '$siteDoc.code',
                  name: '$siteDoc.name',
                  type: '$siteDoc.type'
                },
                item: {
                  _id: '$itemDoc._id',
                  code: '$itemDoc.code',
                  name: '$itemDoc.name',
                  description: '$itemDoc.description',
                  category: '$itemDoc.category',
                  unit: '$itemDoc.unit',
                  reorderLevel: '$itemDoc.reorderLevel'
                }
              }
            }
          ]
        }
      }
    ]);

    const statsRow = result?.stats?.[0] || {
      totalItems: 0,
      totalStockValue: 0,
      categoryCount: 0
    };
    const total = result?.totalCount?.[0]?.count || 0;
    const lowStockCount = result?.lowStock?.[0]?.count || 0;
    const outOfStockCount = result?.lowStock?.[0]?.out || 0;

    // A restock already on its way, so the page shows it instead of offering
    // a second one for the same shelf.
    const rows: any[] = result?.data || [];
    const itemIds = rows.map((row) => row.item?._id).filter(Boolean);
    if (itemIds.length > 0) {
      const open = await PurchaseRequisition.find({
        restock: true,
        isDeleted: false,
        status: { $nin: PR_TERMINAL_STATUSES as unknown as string[] },
        'items.item': { $in: itemIds }
      })
        .select('requisitionNumber status site items.item')
        .sort({ createdAt: -1 })
        .lean();
      const bySiteItem = new Map<string, any>();
      for (const pr of open as any[]) {
        for (const line of pr.items || []) {
          const key = `${pr.site}:${line.item}`;
          if (!bySiteItem.has(key)) {
            bySiteItem.set(key, { _id: pr._id, requisitionNumber: pr.requisitionNumber, status: pr.status });
          }
        }
      }
      for (const row of rows) {
        row.openRestock = bySiteItem.get(`${row.site?._id}:${row.item?._id}`) || null;
      }

      // The same item free at other sites: a transfer can be quicker than
      // buying, and it explains why one item shows on two rows.
      const elsewhere = await Inventory.find({ item: { $in: itemIds }, isDeleted: false, quantityOnHand: { $gt: 0 } })
        .select('item site quantityOnHand quantityReserved')
        .populate('site', 'name')
        .lean();
      for (const row of rows) {
        row.otherSites = (elsewhere as any[])
          .filter((inv) => String(inv.item) === String(row.item?._id) && String(inv.site?._id) !== String(row.site?._id))
          .map((inv) => ({
            siteId: inv.site?._id,
            siteName: inv.site?.name || 'another site',
            available: Math.max(0, (inv.quantityOnHand || 0) - (inv.quantityReserved || 0))
          }))
          .filter((other) => other.available > 0);
      }
    }

    res.status(200).json({
      success: true,
      data: rows,
      stats: {
        totalItems: statsRow.totalItems,
        lowStockCount,
        outOfStockCount,
        totalStockValue: statsRow.totalStockValue,
        categoryCount: statsRow.categoryCount
      },
      pagination: {
        page: parseInt(page, 10),
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit) || 0
      }
    });
  } catch (error: any) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getInventory;
