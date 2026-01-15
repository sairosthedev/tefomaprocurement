const { SupplierProfile } = require('../../models');
const { createAuditLog } = require('../../middleware');

const approveSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const previousStatus = supplier.status;
    supplier.status = 'active';
    supplier.approvedBy = req.user._id;
    supplier.approvedAt = new Date();
    if (notes) supplier.notes = notes;

    await supplier.save();

    await createAuditLog({
      action: 'approve',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Approved supplier: ${supplier.companyName}`,
      previousData: { status: previousStatus },
      newData: { status: 'active' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Supplier approved successfully',
      data: supplier
    });
  } catch (error) {
    console.error('Approve supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = approveSupplier;

