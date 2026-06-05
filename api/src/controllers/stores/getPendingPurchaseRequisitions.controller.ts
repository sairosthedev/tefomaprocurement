import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';

const getPendingPurchaseRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const requisitions = await PurchaseRequisition.find({
      status: 'stores_review',
      isDeleted: false
    })
      .populate('requestedBy', 'firstName lastName email')
      .populate('department', 'name code')
      .populate('site', 'code name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: requisitions });
  } catch (error) {
    console.error('Get stores PR queue error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPendingPurchaseRequisitions;
