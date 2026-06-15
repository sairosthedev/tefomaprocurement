import type { Request, Response } from 'express';
import { RFQ, Quotation } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

/** Procurement Manager authorizes the quotation */
const authorizeQuotation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { quotationId, comments } = req.body;

    const rfq = await RFQ.findById(id);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }

    const qid = quotationId || rfq.hodSelection?.quotation;
    if (!qid) {
      return res.status(400).json({
        success: false,
        message: 'HOD must select a quotation before PM authorization'
      });
    }

    if (!rfq.hodSelection?.quotation || String(rfq.hodSelection.quotation) !== String(qid)) {
      return res.status(400).json({
        success: false,
        message: 'Can only authorize the quotation selected by HOD'
      });
    }

    const quotation = await Quotation.findById(qid);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    rfq.pmAuthorization = {
      quotation: quotation._id,
      authorizedBy: req.user!._id,
      authorizedAt: new Date()
    };
    await rfq.save();

    await createAuditLog({
      action: 'approve',
      entity: 'RFQ',
      entityId: rfq._id,
      user: req.user,
      description: `PM authorized quotation for RFQ ${rfq.rfqNumber}`,
      newData: { quotationId: qid, comments },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Quotation authorized by Procurement Manager. Ready for acceptance.',
      data: rfq
    });
  } catch (error) {
    console.error('Authorize quotation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default authorizeQuotation;
