import type { Request, Response } from 'express';

import { Delivery } from '../../models/index.js';

const getDeliveries = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, supplierId, page = 1, limit = 20 } = req.query as Record<string, any>;
    
    const query = { isDeleted: false };
    
    if (status) query.status = status;
    if (supplierId) query.supplier = supplierId;

    const skip = (page - 1) * limit;
    
    const [deliveries, total] = await Promise.all([
      Delivery.find(query)
        .populate('purchaseOrder', 'poNumber')
        .populate('supplier', 'companyName')
        .populate('receivedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Delivery.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: deliveries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getDeliveries;
