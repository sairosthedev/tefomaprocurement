const { Quotation, RFQ } = require('../../models');
const { createAuditLog } = require('../../middleware');

const rejectQuotation = async (req, res) => {
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
      previousData: { status: quotation.status },
      newData: { status: 'rejected', reason, comments },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Quotation rejected successfully',
      data: quotation
    });
  } catch (error) {
    console.error('Reject quotation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = rejectQuotation;

