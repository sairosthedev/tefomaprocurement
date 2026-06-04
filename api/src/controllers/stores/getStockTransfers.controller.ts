import type { Request, Response } from 'express';

import { StockTransfer } from '../../models/index.js';
import { canAccessAllSites, userSiteId } from '../../lib/siteScope.js';

const getStockTransfers = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, site: querySite, page = 1, limit = 20 } = req.query as Record<string, any>;
    const query = { isDeleted: false };

    if (status) query.status = status;

    if (canAccessAllSites(req.user) && querySite) {
      query.$or = [{ fromSite: querySite }, { toSite: querySite }];
    } else if (!canAccessAllSites(req.user)) {
      const home = userSiteId(req.user);
      if (!home) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 0 }
        });
      }
      query.$or = [{ fromSite: home }, { toSite: home }];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [transfers, total] = await Promise.all([
      StockTransfer.find(query)
        .populate('fromSite', 'code name type')
        .populate('toSite', 'code name type')
        .populate('initiatedBy', 'firstName lastName')
        .populate('items.item', 'code name unit')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      StockTransfer.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: transfers,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get stock transfers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getStockTransfers;
