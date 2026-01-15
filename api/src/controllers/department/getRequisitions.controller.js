const { PurchaseRequisition } = require('../../models');

const getRequisitions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = { 
      department: req.user.department,
      isDeleted: false 
    };
    
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    
    const [requisitions, total] = await Promise.all([
      PurchaseRequisition.find(query)
        .populate('requestedBy', 'firstName lastName')
        .populate('department', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PurchaseRequisition.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: requisitions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getRequisitions;

