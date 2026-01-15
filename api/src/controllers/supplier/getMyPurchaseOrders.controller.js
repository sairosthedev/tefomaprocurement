const { PurchaseOrder, SupplierProfile } = require('../../models');

const getMyPurchaseOrders = async (req, res) => {
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
      supplier: profile._id,
      isDeleted: false,
      status: { $in: ['issued', 'partially_received', 'completed'] }
    };
    
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .select('poNumber items totalAmount status expectedDeliveryDate issuedAt')
        .sort({ issuedAt: -1 })
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
    console.error('Get my POs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getMyPurchaseOrders;

