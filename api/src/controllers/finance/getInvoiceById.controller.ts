import type { Request, Response } from 'express';
import { Invoice, Delivery } from '../../models/index.js';
import { performThreeWayMatch } from '../../services/threeWayMatch.service.js';

const getInvoiceById = async (req: Request, res: Response): Promise<any> => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('purchaseOrder')
      .populate('supplier', 'companyName email bankDetails')
      .populate('submittedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName')
      .populate('rejectedBy', 'firstName lastName');

    if (!invoice || invoice.isDeleted) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const po = invoice.purchaseOrder as any;
    const deliveries = po
      ? await Delivery.find({
          purchaseOrder: po._id,
          isDeleted: false,
          status: { $in: ['accepted', 'partially_accepted'] }
        }).sort({ deliveryDate: -1 })
      : [];

    const freshMatch = po ? performThreeWayMatch(po, invoice.items, invoice.vatAmount ?? 0) : null;

    res.status(200).json({
      success: true,
      data: {
        invoice,
        deliveries,
        freshMatch
      }
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getInvoiceById;
