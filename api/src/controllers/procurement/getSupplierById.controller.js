const { SupplierProfile } = require('../../models');

const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await SupplierProfile.findById(id)
      .populate('user', 'email firstName lastName phone status')
      .populate('approvedBy', 'firstName lastName')
      .populate('blacklistedBy', 'firstName lastName');

    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getSupplierById;

