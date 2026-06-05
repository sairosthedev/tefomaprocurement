import type { Request, Response } from 'express';
import { Invoice, PurchaseOrder } from '../../models/index.js';
import { performThreeWayMatch } from '../../services/threeWayMatch.service.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

const approveInvoice = async (req: Request, res: Response): Promise<any> => {
  try {
    const { comments, forceApprove } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice || invoice.isDeleted) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (!['submitted', 'variance'].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve invoice with status: ${invoice.status}`
      });
    }

    const po = await PurchaseOrder.findById(invoice.purchaseOrder);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    const matchResult = performThreeWayMatch(po, invoice.items);
    if (!matchResult.matched && !forceApprove) {
      invoice.status = 'variance';
      invoice.matchResult = matchResult;
      await invoice.save();
      return res.status(400).json({
        success: false,
        message: 'Three-way match failed. Review variances or use force approve.',
        data: { matchResult }
      });
    }

    invoice.status = 'approved';
    invoice.matchResult = matchResult;
    invoice.approvedBy = req.user!._id;
    invoice.approvedAt = new Date();
    if (comments) invoice.notes = comments;
    await invoice.save();

    await createAuditLog({
      action: 'approve',
      entity: 'Invoice',
      entityId: invoice._id,
      user: req.user,
      description: `Approved invoice ${invoice.invoiceNumber}${forceApprove ? ' (forced)' : ''}`,
      newData: { status: 'approved', matched: matchResult.matched },
      req
    });

    await createNotification({
      recipient: invoice.submittedBy,
      type: 'invoice_approved',
      title: 'Invoice approved for payment',
      message: `Invoice ${invoice.invoiceNumber} has been approved.`,
      entity: 'Invoice',
      entityId: invoice._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Invoice approved for payment',
      data: invoice
    });
  } catch (error) {
    console.error('Approve invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default approveInvoice;
