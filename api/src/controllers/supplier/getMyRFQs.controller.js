const { RFQ, SupplierProfile, Quotation } = require('../../models');

const getMyRFQs = async (req, res) => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user._id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const { status, page = 1, limit = 20 } = req.query;
    
    const query = { 
      isDeleted: false,
      'invitedSuppliers.supplier': profile._id,
      status: { $in: ['open', 'closed', 'evaluating', 'awarded'] }
    };
    
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    
    const [rfqs, total] = await Promise.all([
      RFQ.find(query)
        .populate('invitedSuppliers.supplier', '_id')
        .populate('invitedSuppliers.quotation', 'status quotationNumber')
        .select('rfqNumber title description items submissionDeadline status publishedAt invitedSuppliers')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      RFQ.countDocuments(query)
    ]);

    // Add responded status and quotation status for each RFQ
    const rfqsWithStatus = rfqs.map(rfq => {
      const invitation = rfq.invitedSuppliers?.find(
        inv => {
          const supplierId = inv.supplier?._id || inv.supplier;
          return supplierId.toString() === profile._id.toString();
        }
      );
      
      // Get quotation status if quotation exists
      let quotationStatus = null;
      if (invitation?.quotation) {
        const quotation = invitation.quotation;
        quotationStatus = quotation.status || null;
      }
      
      return {
        ...rfq.toObject(),
        hasResponded: invitation?.responded || false,
        hasSubmitted: invitation?.responded || false,
        quotationStatus: quotationStatus
      };
    });

    res.status(200).json({
      success: true,
      data: rfqsWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get my RFQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getMyRFQs;

