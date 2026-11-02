import type { Request, Response } from 'express';
import { RFQ, Quotation, User } from '../../models/index.js';
import { isProcurementHead } from '@fossil/shared';
import { meetsMinimumQuotations } from '../../services/quotationCompliance.service.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotifications } from '../../services/notification.service.js';

/**
 * Procurement selects the winning quotation, with a justification.
 *
 * This was the requesting department head's step (Rev 9 clause 5.2.1); it now
 * sits with procurement, who run the sourcing. The record keeps its
 * `hodSelection` name so existing RFQs read the same.
 */
const selectQuotation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { quotationId, justification } = req.body;

    if (!quotationId || !justification?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Quotation ID and selection justification are required'
      });
    }

    const rfq = await RFQ.findById(id);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }

    const quotation = await Quotation.findOne({ _id: quotationId, rfq: id, isDeleted: false });
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found for this RFQ' });
    }

    const { met, count } = await meetsMinimumQuotations(String(rfq._id), rfq);
    if (!met) {
      return res.status(400).json({
        success: false,
        message: `Minimum ${3} quotations required or an approved waiver (currently ${count})`,
        data: { quotationCount: count }
      });
    }

    rfq.hodSelection = {
      quotation: quotation._id,
      justification: justification.trim(),
      approvedBy: req.user!._id,
      approvedAt: new Date()
    };
    rfq.selectedQuotation = quotation._id;
    await rfq.save();

    await createAuditLog({
      action: 'approve',
      entity: 'RFQ',
      entityId: rfq._id,
      user: req.user,
      description: `Procurement selected quotation for RFQ ${rfq.rfqNumber}`,
      newData: { quotationId, justification },
      req
    });

    // Authorization is the Head of Procurement's, so tell them, not the officers.
    // The notification points at the quotation: that page carries the
    // authorize control, the RFQ page does not.
    const heads = (
      await User.find({ role: 'department_head', status: 'active', isDeleted: false })
        .select('_id email firstName lastName role department')
        .populate('department', 'name code')
    ).filter((u: any) => isProcurementHead(u));
    if (heads.length) await createNotifications(heads, {
      type: 'quotation_submitted',
      title: 'Quotation selected — your authorization required',
      message: `RFQ ${rfq.rfqNumber}: a quotation was selected. Head of Procurement authorization required.`,
      entity: 'Quotation',
      entityId: quotation._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Quotation selected. Awaiting Procurement Manager authorization.',
      data: rfq
    });
  } catch (error) {
    console.error('Select quotation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default selectQuotation;
