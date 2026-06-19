import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';

const getPendingPoApprovals = async (req: Request, res: Response): Promise<any> => {
  try {
    const { page = 1, limit = 20 } = req.query as Record<string, any>;
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      isDeleted: false,
      status: { $in: ['pending_hod', 'pending_approvals'] },
      hodApproved: false
    };

    const [total, orders] = await Promise.all([
      PurchaseOrder.countDocuments(filter),
      PurchaseOrder.find(filter)
        .populate('supplier', 'companyName')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('Get pending PO approvals (HOD) error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPendingPoApprovals;
