import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { enrichRequisitionItemsWithAvailability } from '../../services/inventoryAvailability.service.js';

const getPendingPurchaseRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { page = 1, limit = 20 } = req.query as Record<string, any>;
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter = { status: 'stores_review', isDeleted: false };

    const [total, requisitions] = await Promise.all([
      PurchaseRequisition.countDocuments(filter),
      PurchaseRequisition.find(filter)
        .populate('requestedBy', 'firstName lastName email')
        .populate('department', 'name code')
        .populate('site', 'code name')
        .populate('hodApprovedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    const data = await Promise.all(
      requisitions.map(async (pr) => {
        const obj = pr.toObject();
        if (pr.site) {
          obj.items = await enrichRequisitionItemsWithAvailability(pr.items as any[], pr.site);
        }
        return obj;
      })
    );

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('Get stores PR queue error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPendingPurchaseRequisitions;
