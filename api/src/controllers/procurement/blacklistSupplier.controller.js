const { SupplierProfile } = require('../../models');
const { createAuditLog } = require('../../middleware');

const blacklistSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for blacklisting is required'
      });
    }

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const previousStatus = supplier.status;
    supplier.status = 'blacklisted';
    supplier.blacklistReason = reason;
    supplier.blacklistedBy = req.user._id;
    supplier.blacklistedAt = new Date();

    await supplier.save();

    await createAuditLog({
      action: 'status_change',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Blacklisted supplier: ${supplier.companyName}. Reason: ${reason}`,
      previousData: { status: previousStatus },
      newData: { status: 'blacklisted', blacklistReason: reason },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Supplier blacklisted successfully',
      data: supplier
    });
  } catch (error) {
    console.error('Blacklist supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = blacklistSupplier;

