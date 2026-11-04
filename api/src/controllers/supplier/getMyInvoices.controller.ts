import type { Request, Response } from 'express';
import { Invoice, Payment, SupplierProfile } from '../../models/index.js';
import { supplierListQuery } from './getMyRFQs.controller.js';

/** Every invoice status; a supplier sees all of their own invoices. */
const INVOICE_STATUSES = ['draft', 'submitted', 'variance', 'approved', 'rejected', 'partially_paid', 'paid', 'cancelled'];

/**
 * One invoice as its supplier sees it. Left out: the variance override (the
 * reason finance gave for paying despite a failed match), the match's
 * internal workings, finance's approval comments (which overwrite `notes`)
 * and staff ids.
 */
function supplierSafeInvoice(invoice: any, payments: any[]) {
  const match = invoice.matchResult;
  return {
    _id: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    vendorInvoiceNumber: invoice.vendorInvoiceNumber,
    purchaseOrder: invoice.purchaseOrder,
    items: invoice.items,
    subtotal: invoice.subtotal,
    vatAmount: invoice.vatAmount,
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    currency: invoice.currency,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    approvedAt: invoice.approvedAt,
    rejectedAt: invoice.rejectedAt,
    rejectionReason: invoice.rejectionReason,
    matchResult: match
      ? {
          matched: match.matched,
          messages: match.messages || [],
          grvNumbers: match.grvNumbers || [],
          matchedAt: match.matchedAt
        }
      : null,
    payments,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt
  };
}

const getMyInvoices = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Supplier profile not found' });
    }

    const { page, limit, skip, statuses, statusRequested } = supplierListQuery(req.query, INVOICE_STATUSES);
    const query: any = { supplier: profile._id, isDeleted: false };
    if (statusRequested) query.status = { $in: statuses };

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('purchaseOrder', 'poNumber totalAmount status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(query)
    ]);

    // When and how each invoice was paid. A payment can settle several
    // invoices, so its own amount is not shown against any one of them; the
    // invoice's amountPaid is.
    const payments: any[] = invoices.length
      ? await Payment.find({
          supplier: profile._id,
          invoices: { $in: invoices.map((inv: any) => inv._id) },
          status: 'completed',
          isDeleted: false
        })
          .select('paymentNumber paymentDate paymentMethod reference invoices')
          .sort({ paymentDate: 1 })
          .lean()
      : [];
    const paymentsFor = (invoiceId: unknown) =>
      payments
        .filter((p) => (p.invoices || []).some((id: unknown) => String(id) === String(invoiceId)))
        .map((p) => ({
          paymentNumber: p.paymentNumber,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          reference: p.reference
        }));

    res.status(200).json({
      success: true,
      data: invoices.map((inv: any) => supplierSafeInvoice(inv, paymentsFor(inv._id))),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get my invoices error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getMyInvoices;
