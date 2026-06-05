import type { Request, Response } from 'express';
import { Invoice, SupplierProfile } from '../../models/index.js';

const getMyInvoices = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Supplier profile not found' });
    }

    const { status, page = 1, limit = 20 } = req.query as Record<string, any>;
    const query: any = { supplier: profile._id, isDeleted: false };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('purchaseOrder', 'poNumber totalAmount status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Invoice.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get my invoices error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getMyInvoices;
