import type { Request, Response } from 'express';
import { SupplierEvaluation } from '../../models/index.js';

const getPendingEvaluations = async (req: Request, res: Response): Promise<any> => {
  try {
    const evaluations = await SupplierEvaluation.find({
      status: 'pending_hod',
      isDeleted: false
    })
      .populate('supplier', 'companyName status overallScore')
      .populate('evaluatedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: evaluations
    });
  } catch (error) {
    console.error('Get pending evaluations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPendingEvaluations;
