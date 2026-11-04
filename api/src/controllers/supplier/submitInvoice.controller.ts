import type { Request, Response } from 'express';
import { Invoice, PurchaseOrder, SupplierProfile } from '../../models/index.js';
import {
  collectGrvEvidence,
  collectPriorBilling,
  performThreeWayMatch
} from '../../services/threeWayMatch.service.js';
import { syncPurchaseOrderFinancials } from '../../services/purchaseOrderFinancials.service.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';
import { escapeRegex } from '../../lib/regex.js';

const submitInvoice = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Supplier profile not found' });
    }

    const {
      purchaseOrderId,
      vendorInvoiceNumber,
      invoiceDate,
      dueDate,
      items,
      vatAmount = 0,
      notes
    } = req.body;

    if (!purchaseOrderId || !items?.length || !invoiceDate) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order, invoice date, and line items are required'
      });
    }

    const po = await PurchaseOrder.findById(purchaseOrderId);
    if (!po || po.isDeleted) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (String(po.supplier) !== String(profile._id)) {
      return res.status(403).json({ success: false, message: 'This purchase order is not assigned to you' });
    }

    if (!['issued', 'partially_received', 'completed'].includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: 'Invoices can only be submitted for issued or received purchase orders'
      });
    }

    // A supplier's invoice number identifies one bill. The same number on a
    // second live invoice is the classic duplicate-payment route, whichever PO
    // it is raised against. Checked here rather than by a unique index because
    // existing records may already collide.
    const vendorNumber = vendorInvoiceNumber != null ? String(vendorInvoiceNumber).trim() : '';
    if (vendorNumber) {
      const duplicate = await Invoice.findOne({
        supplier: profile._id,
        isDeleted: false,
        status: { $nin: ['rejected', 'cancelled'] },
        // Trimmed and case-insensitive: "inv-001 " and "INV-001" are one bill.
        vendorInvoiceNumber: { $regex: `^\\s*${escapeRegex(vendorNumber)}\\s*$`, $options: 'i' }
      }).select('invoiceNumber');
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `You have already submitted invoice number ${vendorNumber} (${duplicate.invoiceNumber}). Use a new invoice number, or ask finance to reject the earlier one first.`
        });
      }
    }

    const invoiceItems = items.map((item: any, index: number) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice ?? item.quantity * item.unitPrice),
      poItemIndex: item.poItemIndex ?? index
    }));

    // Matched against what was received less what other invoices on this PO
    // have already billed.
    const [evidence, prior] = await Promise.all([collectGrvEvidence(po), collectPriorBilling(po)]);
    const matchResult = performThreeWayMatch(po, invoiceItems, evidence, Number(vatAmount) || 0, prior);
    const status = matchResult.matched ? 'submitted' : 'variance';

    const invoice = await Invoice.create({
      vendorInvoiceNumber: vendorNumber || undefined,
      purchaseOrder: po._id,
      supplier: profile._id,
      submittedBy: req.user!._id,
      items: invoiceItems,
      currency: po.currency,
      vatAmount: Number(vatAmount) || 0,
      invoiceDate: new Date(invoiceDate),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status,
      matchResult,
      notes
    });

    await syncPurchaseOrderFinancials(po._id);

    await createAuditLog({
      action: 'create',
      entity: 'Invoice',
      entityId: invoice._id,
      user: req.user,
      description: `Supplier submitted invoice ${invoice.invoiceNumber} for PO ${po.poNumber}`,
      newData: { status, matched: matchResult.matched },
      req
    });

    await notifyUsersByRole('finance', {
      type: 'invoice_submitted',
      title: matchResult.matched ? 'Invoice ready for approval' : 'Invoice has variances',
      message: `Invoice ${invoice.invoiceNumber} for PO ${po.poNumber} requires finance review.`,
      entity: 'Invoice',
      entityId: invoice._id,
      relatedUser: req.user!._id
    });

    res.status(201).json({
      success: true,
      message: matchResult.matched
        ? 'Invoice submitted and passed three-way match'
        : 'Invoice submitted with variances — finance review required',
      data: invoice
    });
  } catch (error: any) {
    console.error('Submit invoice error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default submitInvoice;
