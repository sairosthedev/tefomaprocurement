const { RFQ } = require('../../models');

const getRFQById = async (req, res) => {
  try {
    const { id } = req.params;

    const rfq = await RFQ.findById(id)
      .populate('createdBy', 'firstName lastName email')
      .populate('invitedSuppliers.supplier', 'companyName contactEmail contactPhone')
      .populate('invitedSuppliers.quotation', 'quotationNumber status submittedAt totalAmount')
      .populate('purchaseRequisition', 'requisitionNumber title department')
      .populate({
        path: 'purchaseRequisition',
        populate: {
          path: 'department',
          select: 'name code'
        }
      })
      .lean();

    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found'
      });
    }

    res.status(200).json({
      success: true,
      data: rfq
    });
  } catch (error) {
    console.error('Get RFQ by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getRFQById;






