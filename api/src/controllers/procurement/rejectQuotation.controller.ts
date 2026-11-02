import type { Request, Response } from 'express';

import { Quotation, RFQ } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifySupplier } from '../../services/notification.service.js';

const rejectQuotation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason, comments } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

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
        message: 'Only submitted or under review quotations can be rejected'
      });
    }

    const previousStatus = quotation.status;
    quotation.status = 'rejected';
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
      description: `Rejected quotation ${quotation.quotationNumber}`,
      previousData: { status: previousStatus },
      newData: { status: 'rejected', reason, comments },
      req
    });

    if (quotation.supplier) {
      const rfqDoc = quotation.rfq as any;
      await notifySupplier(quotation.supplier, {
        type: 'quotation_rejected',
        title: 'Quotation not selected',
        message: `Your quotation ${quotation.quotationNumber}${rfqDoc?.rfqNumber ? ` for RFQ ${rfqDoc.rfqNumber}` : ''} was not selected.${reason ? ` Reason: ${reason}` : ''}`,
        entity: 'Quotation',
        entityId: quotation._id,
        relatedUser: req.user!._id,
        metadata: {
          rfqNumber: rfqDoc?.rfqNumber,
          quotationNumber: quotation.quotationNumber,
          reason
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Quotation rejected successfully',
      data: quotation
    });
  } catch (error: any) {
    console.error('Reject quotation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default rejectQuotation;
