import type { Request, Response } from 'express';
import { Payment, Invoice } from '../../models/index.js';
import { syncPurchaseOrderFinancials } from '../../services/purchaseOrderFinancials.service.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

const createPayment = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      invoiceIds,
      paymentDate,
      paymentMethod = 'bank_transfer',
      reference,
      notes,
      complete = true
    } = req.body;

    if (!invoiceIds?.length || !paymentDate) {
      return res.status(400).json({
        success: false,
        message: 'At least one invoice and payment date are required'
      });
    }

    const invoices = await Invoice.find({
      _id: { $in: invoiceIds },
      isDeleted: false,
      status: { $in: ['approved', 'partially_paid'] }
    });

    if (invoices.length !== invoiceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'All invoices must be approved and not fully paid'
      });
    }

    const supplierId = invoices[0].supplier;
    if (!invoices.every((inv) => String(inv.supplier) === String(supplierId))) {
      return res.status(400).json({
        success: false,
        message: 'All invoices must belong to the same supplier'
      });
    }

    const amount = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'No balance due on selected invoices' });
    }

    const payment = await Payment.create({
      supplier: supplierId,
      invoices: invoiceIds,
      amount,
      paymentDate: new Date(paymentDate),
      paymentMethod,
      reference,
      notes,
      status: complete ? 'completed' : 'draft',
      createdBy: req.user!._id,
      ...(complete
        ? { completedBy: req.user!._id, completedAt: new Date() }
        : {})
    });

    if (complete) {
      for (const invoice of invoices) {
        invoice.amountPaid = invoice.totalAmount;
        invoice.balanceDue = 0;
        invoice.status = 'paid';
        await invoice.save();
        await syncPurchaseOrderFinancials(invoice.purchaseOrder);

        await createNotification({
          recipient: invoice.submittedBy,
          type: 'invoice_paid',
          title: 'Payment recorded',
          message: `Payment ${payment.paymentNumber} cleared invoice ${invoice.invoiceNumber}.`,
          entity: 'Payment',
          entityId: payment._id,
          relatedUser: req.user!._id
        });
      }
    }

    await createAuditLog({
      action: 'create',
      entity: 'Payment',
      entityId: payment._id,
      user: req.user,
      description: `Created payment ${payment.paymentNumber} for ${amount}`,
      newData: { invoiceIds, amount, status: payment.status },
      req
    });

    const populated = await Payment.findById(payment._id)
      .populate('supplier', 'companyName')
      .populate('invoices', 'invoiceNumber totalAmount status');

    res.status(201).json({
      success: true,
      message: complete ? 'Payment completed' : 'Payment draft created',
      data: populated
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default createPayment;
