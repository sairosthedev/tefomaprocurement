const { RFQ } = require('../../models');

const getRFQs = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    const query = { isDeleted: false };
    
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { rfqNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const [rfqs, total] = await Promise.all([
      RFQ.find(query)
        .populate('createdBy', 'firstName lastName')
        .populate('purchaseRequisition', 'requisitionNumber')
        .populate('invitedSuppliers.supplier', 'companyName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      RFQ.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: rfqs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get RFQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getRFQs;

