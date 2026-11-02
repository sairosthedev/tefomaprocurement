import type { Request, Response } from 'express';

import { RFQ, Quotation, User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { snapshotRanking } from '../../services/quotationRanking.service.js';
import { createNotifications } from '../../services/notification.service.js';
import { isProcurementHead } from '@fossil/shared';

/**
 * Close an open RFQ to stop accepting bids and reveal them for evaluation.
 * Useful when every invited supplier has already responded before the
 * deadline, so procurement doesn't have to wait it out.
 */
const closeRFQ = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const rfq = await RFQ.findById(id);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }

    if (rfq.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: `Only open RFQs can be closed (current status: ${rfq.status})`
      });
    }

    const quotationCount = await Quotation.countDocuments({
      rfq: rfq._id,
      isDeleted: false
    });

    rfq.status = quotationCount > 0 ? 'evaluating' : 'closed';
    rfq.closedAt = new Date();
    await rfq.save();

    // Bids are revealed at this point, so record the ranking as it stands now:
    // the award has to be defensible against the figures the officer actually
    // saw, not against a recomputation taken weeks later. A failure here must
    // not block the close, which is the operation the officer asked for.
    let ranking: any = null;
    if (quotationCount > 0) {
      try {
        ranking = await snapshotRanking(rfq, req.user!._id);
      } catch (rankError: any) {
        console.error('Ranking snapshot failed for RFQ', rfq.rfqNumber, rankError);
      }
    }

    await createAuditLog({
      action: 'status_change',
      entity: 'RFQ',
      entityId: rfq._id,
      user: req.user,
      description: `Closed RFQ ${rfq.rfqNumber} - bids revealed for evaluation`,
      previousData: { status: 'open' },
      newData: {
        status: rfq.status,
        rankedResponses: ranking?.responses?.length ?? 0,
        recommendedQuotation: ranking?.recommendedQuotationId
      },
      req
    });

    // If fewer than 3 quotations, a waiver is required before award. Notify the
    // COO and Head of Procurement so the waiver can be approved without delay.
    if (quotationCount < 3) {
      try {
        const approvers = (
          await User.find({ role: { $in: ['coo', 'department_head'] }, status: 'active', isDeleted: false })
            .select('_id role email firstName lastName department')
            .populate('department', 'name code')
        ).filter((u: any) => u.role === 'coo' || isProcurementHead(u));

        if (approvers.length) {
          await createNotifications(approvers, {
            type: 'rfq_deadline_approaching',
            title: 'Quotation waiver required',
            message: `RFQ ${rfq.rfqNumber} closed with only ${quotationCount} quotation${quotationCount !== 1 ? 's' : ''} (minimum 3). A waiver must be approved before an award can be made.`,
            entity: 'RFQ',
            entityId: rfq._id,
            relatedUser: req.user!._id
          });
        }
      } catch (notifyErr) {
        console.error('Waiver notification failed for RFQ', rfq.rfqNumber, notifyErr);
      }
    }

    res.status(200).json({
      success: true,
      message:
        quotationCount > 0
          ? 'RFQ closed. Bids are now visible for evaluation.'
          : 'RFQ closed. No bids were received.',
      data: rfq,
      ranking
    });
  } catch (error: any) {
    console.error('Close RFQ error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default closeRFQ;
