import type { Request, Response } from 'express';

import { PurchaseOrder } from '../../models/index.js';

const getPurchaseOrders = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, supplierId, search, page = 1, limit = 20 } = req.query as Record<string, any>;
    
    const query = { isDeleted: false };
    
    if (status) query.status = status;
    if (supplierId) query.supplier = supplierId;
    if (search) {
      query.poNumber = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .select('poNumber status financeApproved cooApproved financeApprovedBy cooApprovedBy financeApprovedAt cooApprovedAt supplier createdBy quotation items totalAmount expectedDeliveryDate createdAt')
        .populate('supplier', 'companyName')
        .populate('createdBy', 'firstName lastName')
        .populate('quotation', 'quotationNumber currency')
        .populate('financeApprovedBy', 'firstName lastName')
        .populate('cooApprovedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PurchaseOrder.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get POs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getPurchaseOrders;
