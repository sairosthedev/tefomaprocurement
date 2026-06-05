import type { Request, Response } from 'express';

import { Quotation, RFQ } from '../../models/index.js';
import { quotationFullyAuthorized, meetsMinimumQuotations } from '../../services/quotationCompliance.service.js';
import { createAuditLog } from '../../middleware/index.js';

const acceptQuotation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const quotation = await Quotation.findById(id).populate('rfq');
    if (!quotation || quotation.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    if (quotation.status !== 'submitted' && quotation.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or under review quotations can be accepted'
      });
    }

    const rfq = quotation.rfq as any;
    if (!rfq) {
      return res.status(400).json({ success: false, message: 'RFQ not found for quotation' });
    }

    const { met, count } = await meetsMinimumQuotations(String(rfq._id), rfq);
    if (!met) {
      return res.status(400).json({
        success: false,
        message: `Requires at least 3 quotations or approved waiver (found ${count})`
      });
    }

    if (!quotationFullyAuthorized(rfq, String(quotation._id))) {
      return res.status(400).json({
        success: false,
        message: 'HOD selection with justification and Procurement Manager authorization required before acceptance (FC-HQ-P-07 §5.1.2, §6.3.4)'
      });
    }

    const previousStatus = quotation.status;
    quotation.status = 'accepted';
    await quotation.save();

    rfq.status = 'awarded';
    rfq.selectedQuotation = quotation._id;
    await rfq.save();

    await createAuditLog({
      action: 'status_change',
      entity: 'Quotation',
      entityId: quotation._id,
      user: req.user,
      description: `Accepted quotation ${quotation.quotationNumber}`,
      previousData: { status: previousStatus },
      newData: { status: 'accepted', comments },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Quotation accepted successfully',
      data: quotation
    });
  } catch (error: any) {
    console.error('Accept quotation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default acceptQuotation;
