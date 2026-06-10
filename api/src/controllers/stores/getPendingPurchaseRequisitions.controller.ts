import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { enrichRequisitionItemsWithAvailability } from '../../services/inventoryAvailability.service.js';

const getPendingPurchaseRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const requisitions = await PurchaseRequisition.find({
      status: 'stores_review',
      isDeleted: false
    })
      .populate('requestedBy', 'firstName lastName email')
      .populate('department', 'name code')
      .populate('site', 'code name')
      .populate('hodApprovedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    const data = await Promise.all(
      requisitions.map(async (pr) => {
        const obj = pr.toObject();
        if (pr.site) {
          obj.items = await enrichRequisitionItemsWithAvailability(pr.items as any[], pr.site);
        }
        return obj;
      })
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Get stores PR queue error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPendingPurchaseRequisitions;
