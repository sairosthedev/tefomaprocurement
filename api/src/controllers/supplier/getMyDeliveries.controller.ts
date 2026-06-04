import type { Request, Response } from 'express';

import { Delivery, SupplierProfile } from '../../models/index.js';

const getMyDeliveries = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const { status, page = 1, limit = 20 } = req.query as Record<string, any>;
    
    const query: any = { 
      supplier: profile._id,
      isDeleted: false
    };
    
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    
    const [deliveries, total] = await Promise.all([
      Delivery.find(query)
        .populate('purchaseOrder', 'poNumber expectedDeliveryDate')
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
    console.error('Get my deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getMyDeliveries;
