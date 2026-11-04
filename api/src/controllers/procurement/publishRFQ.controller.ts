import type { Request, Response } from 'express';

import { RFQ } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { hasEnteredLineItems } from '../../lib/lineItems.js';
import { announceOpenRfq, partitionRfqInvitees } from '../../services/rfqPublication.service.js';

const publishRFQ = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const rfq = await RFQ.findById(id);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found'
      });
    }

    if (rfq.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft RFQs can be published'
      });
    }

    if (!rfq.invitedSuppliers || rfq.invitedSuppliers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'RFQ must have at least one invited supplier'
      });
    }

    if (!hasEnteredLineItems(rfq.items)) {
      return res.status(400).json({
        success: false,
        message: 'RFQ must have at least one item before it can be sent to suppliers'
      });
    }

    // Suppliers were validated when the draft was created, but that may have
    // been long ago — re-check before actually inviting anyone.
    const partition = await partitionRfqInvitees(rfq);
    const { eligible, ineligible } = partition;

    if (eligible.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No invited supplier is currently eligible to receive this RFQ.',
        data: { ineligible }
      });
    }

    rfq.status = 'open';
    rfq.publishedAt = new Date();
    await rfq.save();

    // Notify only the suppliers still eligible to quote.
    await announceOpenRfq(rfq, req.user!._id, partition);

    await createAuditLog({
      action: 'status_change',
      entity: 'RFQ',
      entityId: rfq._id,
      user: req.user,
      description:
        `Published RFQ: ${rfq.rfqNumber}` +
        (ineligible.length > 0
          ? ` (${ineligible.length} invited supplier(s) skipped as ineligible)`
          : ''),
      previousData: { status: 'draft' },
      newData: { status: 'open', notified: eligible.length, skipped: ineligible.length },
      req
    });

    res.status(200).json({
      success: true,
      message:
        ineligible.length > 0
          ? `RFQ published to ${eligible.length} supplier(s); ${ineligible.length} skipped as no longer eligible.`
          : 'RFQ published successfully',
      data: rfq,
      ineligible
    });
  } catch (error: any) {
    console.error('Publish RFQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default publishRFQ;
