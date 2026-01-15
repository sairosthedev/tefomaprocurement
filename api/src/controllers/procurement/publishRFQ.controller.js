const { RFQ } = require('../../models');
const { createAuditLog } = require('../../middleware');

const publishRFQ = async (req, res) => {
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

    rfq.status = 'open';
    rfq.publishedAt = new Date();
    await rfq.save();

    // TODO: Send email notifications to invited suppliers

    await createAuditLog({
      action: 'status_change',
      entity: 'RFQ',
      entityId: rfq._id,
      user: req.user,
      description: `Published RFQ: ${rfq.rfqNumber}`,
      previousData: { status: 'draft' },
      newData: { status: 'open' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'RFQ published successfully',
      data: rfq
    });
  } catch (error) {
    console.error('Publish RFQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = publishRFQ;

