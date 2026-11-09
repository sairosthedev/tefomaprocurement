import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { USAGE_WINDOW_DAYS } from '@fossil/shared';

import { Inventory, StoreTransaction } from '../../models/index.js';

/**
 * What one item has done at one site lately: units issued (to departments and
 * out on transfers) and units received, over the usage window. It is what a
 * sensible reorder level is set from.
 */
const getInventoryUsage = async (req: Request, res: Response): Promise<any> => {
  try {
    const inventory = await Inventory.findOne({ _id: req.params.id, isDeleted: false }).select('_id').lean();
    if (!inventory) {
      return res.status(404).json({ success: false, message: 'Stock record not found' });
    }

    const since = new Date(Date.now() - USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await StoreTransaction.aggregate([
      {
        $match: {
          inventory: new mongoose.Types.ObjectId(String(inventory._id)),
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: null,
          issued: {
            $sum: { $cond: [{ $and: [{ $in: ['$type', ['issue', 'transfer']] }, { $lt: ['$quantity', 0] }] }, { $multiply: ['$quantity', -1] }, 0] }
          },
          received: {
            $sum: { $cond: [{ $and: [{ $in: ['$type', ['receipt', 'transfer']] }, { $gt: ['$quantity', 0] }] }, '$quantity', 0] }
          },
          issues: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'issue'] }, { $lt: ['$quantity', 0] }] }, 1, 0] } }
        }
      }
    ]);

    const issued = rows[0]?.issued || 0;
    const months = USAGE_WINDOW_DAYS / 30;
    res.status(200).json({
      success: true,
      data: {
        windowDays: USAGE_WINDOW_DAYS,
        issued,
        received: rows[0]?.received || 0,
        issues: rows[0]?.issues || 0,
        perMonth: Math.round((issued / months) * 10) / 10
      }
    });
  } catch (error: any) {
    console.error('Get inventory usage error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getInventoryUsage;
