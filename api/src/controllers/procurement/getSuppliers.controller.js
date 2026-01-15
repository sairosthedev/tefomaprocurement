const { SupplierProfile } = require('../../models');

const getSuppliers = async (req, res) => {
  try {
    const { status, search, category, page = 1, limit = 20 } = req.query;
    
    const query = { isDeleted: false };
    
    if (status) query.status = status;
    if (category) query.categories = category;
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { tradingName: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const [suppliers, total] = await Promise.all([
      SupplierProfile.find(query)
        .populate('user', 'email firstName lastName phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SupplierProfile.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: suppliers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getSuppliers;

