const { PurchaseOrder } = require('../../models');

const getPendingApprovals = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    // Get POs that are pending approvals and Finance hasn't approved yet
    const query = { 
      status: 'pending_approvals',
      financeApproved: false,
      isDeleted: false 
    };

    const skip = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('supplier', 'companyName')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PurchaseOrder.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getPendingApprovals;

