import type { Request, Response } from 'express';

import { Quotation, RFQ } from '../../models/index.js';
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

    const previousStatus = quotation.status;
    quotation.status = 'accepted';
    await quotation.save();

    // Update RFQ if all quotations are evaluated
    const rfq = quotation.rfq;
    if (rfq) {
      const allQuotations = await Quotation.find({ 
        rfq: rfq._id, 
        isDeleted: false 
      });
      const allEvaluated = allQuotations.every(q => 
        q.status === 'accepted' || q.status === 'rejected'
      );
      
      if (allEvaluated) {
        rfq.status = 'evaluating';
        await rfq.save();
      }
    }

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
