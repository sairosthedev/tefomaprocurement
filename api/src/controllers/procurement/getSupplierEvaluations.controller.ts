import type { Request, Response } from 'express';
import { SupplierEvaluation, SupplierProfile } from '../../models/index.js';

const getSupplierEvaluations = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const evaluations = await SupplierEvaluation.find({ supplier: id, isDeleted: false })
      .populate('evaluatedBy', 'firstName lastName')
      .populate('hodReviewedBy', 'firstName lastName')
      .populate('secApprovedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: evaluations });
  } catch (error) {
    console.error('Get evaluations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getSupplierEvaluations;
