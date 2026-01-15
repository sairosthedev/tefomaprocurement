const { Quotation } = require('../../models');

const getQuotations = async (req, res) => {
  try {
    const { status, rfqId, search, page = 1, limit = 20 } = req.query;
    
    const query = { isDeleted: false };
    
    if (status) query.status = status;
    if (rfqId) query.rfq = rfqId;
    if (search) {
      query.quotationNumber = { $regex: search, $options: 'i' };
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

