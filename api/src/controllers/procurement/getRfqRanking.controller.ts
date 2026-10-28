import type { Request, Response } from 'express';

import { RFQ } from '../../models/index.js';
import { rankRfqResponses } from '../../services/quotationRanking.service.js';

/**
 * GET the ranked responses to an RFQ.
 *
 * Computed live rather than read from a stored table, so a ranking never goes
 * stale against a quote that arrived, was revised, or expired since it was last
 * looked at. A snapshot is written to QuotationEvaluation when the RFQ closes,
 * which is the figure the award decision was actually taken against.
 *
 * Sealed-bid rule: quotations stay hidden until the submission deadline passes
 * or the officer closes the RFQ. A ranking is a view of every bid at once, so
 * it honours the same seal — otherwise this endpoint would be the hole in it.
 */
const getRfqRanking = async (req: Request, res: Response): Promise<any> => {
  try {
    const rfq = await RFQ.findById(req.params.id);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }

    const deadlinePassed = rfq.submissionDeadline
      ? new Date(rfq.submissionDeadline).getTime() <= Date.now()
      : false;
    const sealed = rfq.status === 'open' && !deadlinePassed;

    if (sealed) {
      return res.status(200).json({
        success: true,
        data: {
          rfqId: rfq._id,
          rfqNumber: rfq.rfqNumber,
          sealed: true,
          responses: [],
          invitedCount: rfq.invitedSuppliers?.length || 0,
          respondedCount: rfq.invitedSuppliers?.filter((i: any) => i.responded).length || 0,
          submissionDeadline: rfq.submissionDeadline
        },
        message:
          'Bids are sealed until the submission deadline passes or the RFQ is closed. ' +
          'Ranking becomes available then.'
      });
    }

    const ranking = await rankRfqResponses(rfq);

    res.status(200).json({ success: true, data: { ...ranking, sealed: false } });
  } catch (error: any) {
    console.error('Get RFQ ranking error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default getRfqRanking;
