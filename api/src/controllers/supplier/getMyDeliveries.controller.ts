import type { Request, Response } from 'express';

import { Delivery, SupplierProfile } from '../../models/index.js';
import { supplierListQuery } from './getMyRFQs.controller.js';

/** Every delivery status; a supplier sees all deliveries against their orders. */
const DELIVERY_STATUSES = ['pending', 'received', 'inspected', 'accepted', 'partially_accepted', 'rejected'];

const getMyDeliveries = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const { page, limit, skip, statuses, statusRequested } = supplierListQuery(req.query, DELIVERY_STATUSES);

    const query: any = {
      supplier: profile._id,
      isDeleted: false
    };
    if (statusRequested) query.status = { $in: statuses };

    const [deliveries, total] = await Promise.all([
      Delivery.find(query)
        .populate('purchaseOrder', 'poNumber expectedDeliveryDate')
        .populate('receivedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Delivery.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: deliveries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get my deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getMyDeliveries;
