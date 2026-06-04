import type { Request, Response } from 'express';

import { RFQ, Quotation } from '../../models/index.js';

const getRFQs = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query as Record<string, any>;
    
    const query: any = { isDeleted: false };
    
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { rfqNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const [rfqs, total] = await Promise.all([
      RFQ.find(query)
        .populate('createdBy', 'firstName lastName')
        .populate('purchaseRequisition', 'requisitionNumber')
        .populate('invitedSuppliers.supplier', 'companyName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      RFQ.countDocuments(query)
    ]);

    // Attach the number of bids received per RFQ (count only, no values).
    if (rfqs.length > 0) {
      const counts = await Quotation.aggregate([
        {
          $match: {
            rfq: { $in: rfqs.map((r) => r._id) },
            status: { $in: ['submitted', 'under_review', 'accepted', 'rejected'] },
            isDeleted: false
          }
        },
        { $group: { _id: '$rfq', count: { $sum: 1 } } }
      ]);
      const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
      rfqs.forEach((r) => {
        (r as any).bidCount = countMap.get(r._id.toString()) || 0;
      });
    }

    res.status(200).json({
      success: true,
      data: rfqs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get RFQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getRFQs;
