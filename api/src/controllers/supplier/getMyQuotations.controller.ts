import type { Request, Response } from 'express';

import { Quotation, SupplierProfile } from '../../models/index.js';
import { supplierListQuery } from './getMyRFQs.controller.js';

/** Every quotation status; a supplier sees all of their own quotations. */
const QUOTATION_STATUSES = [
  'draft', 'submitted', 'under_review', 'revision_requested',
  'superseded', 'accepted', 'rejected', 'expired'
];

const getMyQuotations = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const { page, limit, skip, statuses, statusRequested } = supplierListQuery(req.query, QUOTATION_STATUSES);

    const query: any = {
      supplier: profile._id,
      isDeleted: false
    };
    // Unfiltered, every quotation of theirs is listed, legacy statuses too.
    if (statusRequested) query.status = { $in: statuses };

    const [quotations, total] = await Promise.all([
      Quotation.find(query)
        // The list shows each line's figures; the photos stay on the quote.
        .select('-items.attachments')
        .populate('rfq', 'rfqNumber title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Quotation.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: quotations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get my quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getMyQuotations;
