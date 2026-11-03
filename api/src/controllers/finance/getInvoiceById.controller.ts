import type { Request, Response } from 'express';
import { Invoice, Delivery } from '../../models/index.js';
import {
  findReceiptedDeliveries,
  grvEvidenceFrom,
  performThreeWayMatch
} from '../../services/threeWayMatch.service.js';

const getInvoiceById = async (req: Request, res: Response): Promise<any> => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice || invoice.isDeleted) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // The invoice carries its PO's id, so the PO's deliveries and GRVs are read
    // while its references populate rather than after.
    const purchaseOrderId = invoice.purchaseOrder;
    const [, accepted, receipted] = await Promise.all([
      invoice.populate([
        // What the page and the three-way match read of the PO — not its
        // approval trail.
        {
          path: 'purchaseOrder',
          select: 'poNumber status currency items subtotal vatAmount totalAmount totalInvoiced totalPaid'
        },
        // Name only: the supplier's bank details are not shown here.
        { path: 'supplier', select: 'companyName email' },
        { path: 'submittedBy', select: 'firstName lastName email' },
        { path: 'approvedBy', select: 'firstName lastName' },
        { path: 'rejectedBy', select: 'firstName lastName' }
      ]),
      purchaseOrderId
        ? Delivery.find({
            purchaseOrder: purchaseOrderId,
            isDeleted: false,
            status: { $in: ['accepted', 'partially_accepted'] }
          }).sort({ deliveryDate: -1 })
        : [],
      purchaseOrderId ? findReceiptedDeliveries(purchaseOrderId) : []
    ]);

    const po = invoice.purchaseOrder as any;
    const deliveries = po ? accepted : [];

    // Match against the GRVs stores raised, so the preview finance sees is the
    // same evidence the approval gate will apply.
    const freshMatch = po
      ? performThreeWayMatch(po, invoice.items, grvEvidenceFrom(po, receipted), invoice.vatAmount ?? 0)
      : null;

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
