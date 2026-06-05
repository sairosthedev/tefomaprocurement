import type { Request, Response } from 'express';
import { Invoice } from '../../models/index.js';
import { syncPurchaseOrderFinancials } from '../../services/purchaseOrderFinancials.service.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

const rejectInvoice = async (req: Request, res: Response): Promise<any> => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice || invoice.isDeleted) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (!['submitted', 'variance', 'approved'].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject invoice with status: ${invoice.status}`
      });
    }

    invoice.status = 'rejected';
    invoice.rejectedBy = req.user!._id;
    invoice.rejectedAt = new Date();
    invoice.rejectionReason = reason;
    await invoice.save();

    await syncPurchaseOrderFinancials(invoice.purchaseOrder);

    await createAuditLog({
      action: 'reject',
      entity: 'Invoice',
      entityId: invoice._id,
      user: req.user,
      description: `Rejected invoice ${invoice.invoiceNumber}: ${reason}`,
      req
    });

    await createNotification({
      recipient: invoice.submittedBy,
      type: 'invoice_rejected',
      title: 'Invoice rejected',
      message: `Invoice ${invoice.invoiceNumber} was rejected: ${reason}`,
      entity: 'Invoice',
      entityId: invoice._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({ success: true, message: 'Invoice rejected', data: invoice });
  } catch (error) {
    console.error('Reject invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default rejectInvoice;
