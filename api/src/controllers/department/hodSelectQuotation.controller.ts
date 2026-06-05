import type { Request, Response } from 'express';
import { RFQ, Quotation } from '../../models/index.js';
import { meetsMinimumQuotations } from '../../services/quotationCompliance.service.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';

const hodSelectQuotation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { quotationId, justification } = req.body;

    if (!quotationId || !justification?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Quotation ID and selection justification are required (FC-HQ-P-07 §6.3.4)'
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
      description: `HOD selected quotation for RFQ ${rfq.rfqNumber}`,
      newData: { quotationId, justification },
      req
    });

    await notifyUsersByRole('procurement_officer', {
      type: 'quotation_submitted',
      title: 'HOD selected quotation — PM authorization required',
      message: `RFQ ${rfq.rfqNumber}: HOD selected a quote. Procurement Manager authorization required (§5.1.2).`,
      entity: 'RFQ',
      entityId: rfq._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Quotation selected by HOD. Awaiting Procurement Manager authorization.',
      data: rfq
    });
  } catch (error) {
    console.error('HOD select quotation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default hodSelectQuotation;
