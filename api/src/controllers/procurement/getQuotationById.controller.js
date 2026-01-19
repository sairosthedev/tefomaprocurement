const { Quotation, PurchaseOrder } = require('../../models');

const getQuotationById = async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await Quotation.findById(id)
      .populate('rfq', 'rfqNumber title description items submissionDeadline')
      .populate('supplier', 'companyName contactEmail contactPhone')
      .populate('submittedBy', 'firstName lastName email')
      .select('-isDeleted');

    if (!quotation || quotation.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Check if a PO already exists for this quotation
    const existingPO = await PurchaseOrder.findOne({
      quotation: id,
      isDeleted: false
    }).select('poNumber status');

    const quotationData = quotation.toObject();
    if (existingPO) {
      quotationData.existingPurchaseOrder = {
        poNumber: existingPO.poNumber,
        status: existingPO.status,
        _id: existingPO._id
      };
    }

    res.status(200).json({
      success: true,
      data: quotationData
    });
  } catch (error) {
    console.error('Get quotation by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getQuotationById;

