import type { Request, Response } from 'express';

import { Quotation } from '../../models/index.js';
import { isRfqSealed } from '../../lib/rfqVisibility.js';

const getQuotations = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, rfqId, search, page = 1, limit = 20 } = req.query as Record<string, any>;
    
    const query: any = { isDeleted: false };
    
    if (status) query.status = status;
    if (rfqId) query.rfq = rfqId;
    if (search) {
      query.quotationNumber = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    
    const [quotations, total] = await Promise.all([
      Quotation.find(query)
        .populate('rfq', 'rfqNumber title status submissionDeadline')
        .populate('supplier', 'companyName')
        .populate('submittedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Quotation.countDocuments(query)
    ]);

    const isAdmin = req.user!.role === 'admin';
    const data = quotations.map((quotation: any) => {
      const obj = quotation.toObject();
      const sealed = !isAdmin && isRfqSealed(obj.rfq);
      if (!sealed) return { ...obj, isSealed: false };
      return {
        ...obj,
        isSealed: true,
        totalAmount: null,
        items: [],
        supplier: obj.supplier
          ? { ...obj.supplier, companyName: 'Sealed bid' }
          : { companyName: 'Sealed bid' }
      };
    });

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getQuotations;
