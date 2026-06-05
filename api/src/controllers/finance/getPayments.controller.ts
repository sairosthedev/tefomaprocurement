import type { Request, Response } from 'express';
import { Payment } from '../../models/index.js';

const getPayments = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, page = 1, limit = 20 } = req.query as Record<string, any>;
    const query: any = { isDeleted: false };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('supplier', 'companyName')
        .populate('invoices', 'invoiceNumber totalAmount status')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPayments;
