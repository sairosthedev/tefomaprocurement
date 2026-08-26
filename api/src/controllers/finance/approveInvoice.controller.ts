import type { Request, Response } from 'express';
import { Invoice, PurchaseOrder } from '../../models/index.js';
import { collectGrvEvidence, performThreeWayMatch } from '../../services/threeWayMatch.service.js';
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

    const evidence = await collectGrvEvidence(po);
    const matchResult = performThreeWayMatch(po, invoice.items, evidence);

    // Hard gate: goods must be receipted by stores, and accepted, before
    // finance can approve payment. Not overridable — with nothing accepted onto
    // stock there is no evidence of value received to force-approve against.
    // Covers both "no GRV raised" and "GRV raised but everything rejected".
    if (!matchResult.hasGrv || matchResult.receivedValue <= 0) {
      invoice.status = 'variance';
      invoice.matchResult = matchResult;
      await invoice.save();
      return res.status(400).json({
        success: false,
        message: matchResult.hasGrv
          ? 'No goods on this purchase order were accepted into stores. Nothing is payable until stores receipts accepted goods.'
          : 'No GRV raised for this purchase order. Stores must receipt the goods before this invoice can be approved.',
        data: { matchResult }
      });
    }

    // Variances against a real GRV may be overridden, but only with a written
    // reason, which is retained on the invoice and in the audit log.
    const overrideReason = typeof forceApprove === 'string' ? forceApprove.trim() : '';
    if (!matchResult.matched) {
      if (!overrideReason) {
        invoice.status = 'variance';
        invoice.matchResult = matchResult;
        await invoice.save();
        return res.status(400).json({
          success: false,
          message:
            'Three-way match failed. To approve anyway, supply forceApprove with a written reason for the variance.',
          data: { matchResult }
        });
      }

      invoice.varianceOverride = {
        reason: overrideReason,
        approvedBy: req.user!._id,
        approvedAt: new Date(),
        varianceAmount: matchResult.varianceAmount,
        hadGrv: matchResult.hasGrv
      } as any;
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
      description: `Approved invoice ${invoice.invoiceNumber}${
        invoice.varianceOverride ? ` (variance override: ${invoice.varianceOverride.reason})` : ''
      }`,
      newData: {
        status: 'approved',
        matched: matchResult.matched,
        grvNumbers: matchResult.grvNumbers,
        varianceAmount: matchResult.varianceAmount,
        overrideReason: invoice.varianceOverride?.reason
      },
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
