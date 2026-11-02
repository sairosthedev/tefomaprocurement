import type { Request, Response } from 'express';
import { SupplierEvaluation } from '../../models/index.js';

const getEvaluations = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, page = 1, limit = 20 } = req.query as Record<string, any>;
    const filter: Record<string, unknown> = { isDeleted: false };

    if (typeof status === 'string' && status.trim()) {
      filter.status = status.trim();
    }

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [total, evaluations] = await Promise.all([
      SupplierEvaluation.countDocuments(filter),
      SupplierEvaluation.find(filter)
        .populate('supplier', 'companyName status')
        .populate('evaluatedBy', 'firstName lastName')
        .populate('hodReviewedBy', 'firstName lastName')
        .populate('secApprovedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    res.status(200).json({
      success: true,
      data: evaluations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('Get evaluations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getEvaluations;
