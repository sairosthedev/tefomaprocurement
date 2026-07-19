import type { Request, Response } from 'express';
import { Invoice, PurchaseOrder, SupplierProfile } from '../../models/index.js';
import { performThreeWayMatch } from '../../services/threeWayMatch.service.js';
import { syncPurchaseOrderFinancials } from '../../services/purchaseOrderFinancials.service.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';

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

    const invoiceItems = items.map((item: any, index: number) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice ?? item.quantity * item.unitPrice),
      poItemIndex: item.poItemIndex ?? index
    }));

    const matchResult = performThreeWayMatch(po, invoiceItems, Number(vatAmount) || 0);
    const status = matchResult.matched ? 'submitted' : 'variance';

    const invoice = await Invoice.create({
      vendorInvoiceNumber,
      purchaseOrder: po._id,
      supplier: profile._id,
      submittedBy: req.user!._id,
      items: invoiceItems,
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
