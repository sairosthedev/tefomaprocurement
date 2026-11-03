import type { Request, Response } from 'express';

import { RFQ } from '../../models/index.js';

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
        .select('rfqNumber title status submissionDeadline createdAt invitedSuppliers')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      RFQ.countDocuments(query)
    ]);

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
