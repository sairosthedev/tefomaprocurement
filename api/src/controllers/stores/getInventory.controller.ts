import type { Request, Response } from 'express';

import { Inventory } from '../../models/index.js';
import { buildSiteFilterAsync } from '../../lib/siteScope.js';
import { escapeRegex } from '../../lib/regex.js';

const getInventory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { search, category, belowReorderLevel, lowStock, site, page = 1, limit = 50 } =
      req.query as Record<string, any>;

    let siteFilter: Record<string, unknown> = {};
    try {
      siteFilter = await buildSiteFilterAsync(req.user, site);
    } catch (err: any) {
      return res.status(err.statusCode || 403).json({ success: false, message: err.message });
    }

    const filterLowStock = belowReorderLevel === 'true' || lowStock === 'true';
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

    if (filterLowStock) {
      baseStages.push({
        $match: {
          $expr: { $lte: ['$quantityOnHand', '$itemDoc.reorderLevel'] }
        }
      });
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
            {
              $match: {
                $expr: { $lte: ['$quantityOnHand', '$itemDoc.reorderLevel'] }
              }
            },
            { $count: 'count' }
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

    res.status(200).json({
      success: true,
      data: result?.data || [],
      stats: {
        totalItems: statsRow.totalItems,
        lowStockCount,
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
