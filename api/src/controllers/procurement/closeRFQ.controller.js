const { RFQ, Quotation } = require('../../models');
const { createAuditLog } = require('../../middleware');

/**
 * Close an open RFQ to stop accepting bids and reveal them for evaluation.
 * Useful when every invited supplier has already responded before the
 * deadline, so procurement doesn't have to wait it out.
 */
const closeRFQ = async (req, res) => {
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

    await createAuditLog({
      action: 'status_change',
      entity: 'RFQ',
      entityId: rfq._id,
      user: req.user,
      description: `Closed RFQ ${rfq.rfqNumber} - bids revealed for evaluation`,
      previousData: { status: 'open' },
      newData: { status: rfq.status },
      req
    });

    res.status(200).json({
      success: true,
      message:
        quotationCount > 0
          ? 'RFQ closed. Bids are now visible for evaluation.'
          : 'RFQ closed. No bids were received.',
      data: rfq
    });
  } catch (error) {
    console.error('Close RFQ error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = closeRFQ;
