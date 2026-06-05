import type { Request, Response } from 'express';
import { SupplierProfile, SupplierEvaluation } from '../../models/index.js';

const getEvaluationsDue = async (req: Request, res: Response): Promise<any> => {
  try {
    const now = new Date();

    const [suppliersDue, pendingEvaluations] = await Promise.all([
      SupplierProfile.find({
        isDeleted: false,
        status: { $in: ['active', 'dormant'] },
        $or: [
          { nextEvaluationDue: { $lte: now } },
          { nextEvaluationDue: { $exists: false } }
        ]
      }).select('companyName status lastEvaluationAt nextEvaluationDue kysComplete'),
      SupplierEvaluation.find({
        isDeleted: false,
        status: { $in: ['pending_hod', 'pending_sec'] }
      })
        .populate('supplier', 'companyName')
        .sort({ createdAt: -1 })
        .limit(50)
    ]);

    res.status(200).json({
      success: true,
      data: {
        suppliersDueForReview: suppliersDue,
        pendingEvaluations
      }
    });
  } catch (error) {
    console.error('Get evaluations due error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getEvaluationsDue;
