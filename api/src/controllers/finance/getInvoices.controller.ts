import type { Request, Response } from 'express';
import { Invoice } from '../../models/index.js';

const getInvoices = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, purchaseOrderId, search, page = 1, limit = 20 } = req.query as Record<string, any>;
    const query: any = { isDeleted: false };

    if (status) query.status = status;
    if (purchaseOrderId) query.purchaseOrder = purchaseOrderId;
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { vendorInvoiceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('purchaseOrder', 'poNumber totalAmount totalInvoiced totalPaid status')
        .populate('supplier', 'companyName')
        .populate('submittedBy', 'firstName lastName email')
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
    console.error('Get invoices error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getInvoices;
