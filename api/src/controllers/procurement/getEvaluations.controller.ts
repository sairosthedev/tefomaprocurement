import type { Request, Response } from 'express';
import { SupplierEvaluation } from '../../models/index.js';

const getEvaluations = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = { isDeleted: false };

    if (typeof status === 'string' && status.trim()) {
      filter.status = status.trim();
    }

    const evaluations = await SupplierEvaluation.find(filter)
      .populate('supplier', 'companyName status')
      .populate('evaluatedBy', 'firstName lastName')
      .populate('hodReviewedBy', 'firstName lastName')
      .populate('secApprovedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, data: evaluations });
  } catch (error) {
    console.error('Get evaluations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getEvaluations;
