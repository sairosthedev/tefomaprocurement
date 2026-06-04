import type { Request, Response } from 'express';

import { StoreRequisition } from '../../models/index.js';
import { buildSiteFilter } from '../../lib/siteScope.js';

const getStoreRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { search, status, site, page = 1, limit = 20 } = req.query as Record<string, any>;

    let query = {
      isDeleted: false
    };

    try {
      query = { ...query, ...buildSiteFilter(req.user, site) };
    } catch (err) {
      return res.status(err.statusCode || 403).json({ success: false, message: err.message });
    }
    
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { requisitionNumber: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const [requisitions, total] = await Promise.all([
      StoreRequisition.find(query)
        .populate('site', 'code name type')
        .populate('requestedBy', 'firstName lastName')
        .populate('department', 'name')
        .populate('items.item', 'code name description unit')
        .populate('approvedBy', 'firstName lastName')
        .populate('issuedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      StoreRequisition.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: requisitions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get store requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getStoreRequisitions;
