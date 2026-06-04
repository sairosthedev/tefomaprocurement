import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';

const getPendingApprovals = async (req: Request, res: Response): Promise<any> => {
  try {
    const { page = 1, limit = 20 } = req.query as any;

    // Get POs that are pending approvals and COO hasn't approved yet
    const query = {
      status: 'pending_approvals',
      cooApproved: false,
      isDeleted: false
    };

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('supplier', 'companyName')
        .populate('createdBy', 'firstName lastName')
        .populate('approvalHistory.by', 'firstName lastName role')
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
  } catch (error) {
    console.error('Get COO pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getPendingApprovals;
