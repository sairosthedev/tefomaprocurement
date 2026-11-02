import type { Request, Response } from 'express';
import { Quotation, RFQ } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifySupplier } from '../../services/notification.service.js';

/**
 * Procurement requests a revised (usually lower) price from a supplier. The
 * quotation is marked `revision_requested` and unlocked so the supplier can
 * resubmit; the resubmission is a new quotation linked back via `revisionOf`.
 *
 * Allowed while the RFQ is open OR closed, but not once the RFQ is awarded.
 */
const requestQuotationRevision = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason, targetNote } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'A reason for the revision request is required' });
    }

    const quotation = await Quotation.findById(id).populate('rfq');
    if (!quotation || quotation.isDeleted) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    if (!['submitted', 'under_review'].includes(quotation.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot request a revision for a quotation with status "${quotation.status}"`
      });
    }

    const rfq = quotation.rfq as any;
    if (rfq && ['awarded', 'cancelled'].includes(rfq.status)) {
      return res.status(400).json({
        success: false,
        message: 'The RFQ is already awarded — revisions are no longer possible'
      });
    }

    quotation.status = 'revision_requested';
    quotation.isLocked = false;
    quotation.revisionRequests.push({
      requestedBy: req.user!._id,
      reason: reason.trim(),
      targetNote: targetNote?.trim() || undefined,
      requestedAt: new Date()
    });
    await quotation.save();

    await createAuditLog({
      action: 'update',
      entity: 'Quotation',
      entityId: quotation._id,
      user: req.user,
      description: `Requested price revision for quotation ${quotation.quotationNumber}`,
      newData: { reason, targetNote },
      req
    });

    await notifySupplier(quotation.supplier, {
      type: 'quotation_submitted',
      title: 'Price revision requested',
      message: `Procurement has requested a revised price for your quotation ${quotation.quotationNumber}${
        rfq?.rfqNumber ? ` (RFQ ${rfq.rfqNumber})` : ''
      }. Reason: ${reason.trim()}`,
      entity: 'Quotation',
      entityId: quotation._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Price revision requested. The supplier has been notified to resubmit.',
      data: quotation
    });
  } catch (error: any) {
    console.error('Request quotation revision error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default requestQuotationRevision;
