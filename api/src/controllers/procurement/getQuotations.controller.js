const { Quotation, RFQ } = require('../../models');

const getQuotations = async (req, res) => {
  try {
    const { status, rfqId, search, page = 1, limit = 20 } = req.query;
    
    const query = { isDeleted: false };
    
    if (status) query.status = status;
    if (rfqId) query.rfq = rfqId;
    if (search) {
      query.quotationNumber = { $regex: search, $options: 'i' };
    }

    // Sealed bids: hide quotations belonging to RFQs that are still ongoing
    // (open and before deadline). Admins are exempt for oversight.
    if (req.user.role !== 'admin') {
      const sealedRfqs = await RFQ.find({
        status: 'open',
        submissionDeadline: { $gt: new Date() },
        isDeleted: false
      }).select('_id');

      if (sealedRfqs.length > 0) {
        query.rfq = query.rfq
          ? query.rfq
          : { $nin: sealedRfqs.map((r) => r._id) };

        // If a specific sealed RFQ was requested, return nothing.
        if (rfqId && sealedRfqs.some((r) => r._id.toString() === rfqId.toString())) {
          return res.status(200).json({
            success: true,
            data: [],
            pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 },
            sealed: true,
            message: 'Bids are sealed until the RFQ submission deadline passes or the RFQ is closed.'
          });
        }
      }
    }

    const skip = (page - 1) * limit;
    
    const [quotations, total] = await Promise.all([
      Quotation.find(query)
        .populate('rfq', 'rfqNumber title')
        .populate('supplier', 'companyName')
        .populate('submittedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Quotation.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: quotations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getQuotations;

