const { Site, Inventory } = require('../../models');
const { createAuditLog } = require('../../middleware');

const deleteSite = async (req, res) => {
  try {
    const site = await Site.findOne({ _id: req.params.id, isDeleted: false });
    if (!site) {
      return res.status(404).json({ success: false, message: 'Site not found' });
    }

    if (site.type === 'hq') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the HQ site'
      });
    }

    const hasStock = await Inventory.exists({
      site: site._id,
      isDeleted: false,
      quantityOnHand: { $gt: 0 }
    });

    if (hasStock) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete site with stock on hand. Transfer stock first.'
      });
    }

    site.isDeleted = true;
    site.status = 'inactive';
    await site.save();

    await createAuditLog({
      action: 'delete',
      entity: 'Site',
      entityId: site._id,
      user: req.user,
      description: `Deleted site ${site.code}`,
      req
    });

    res.status(200).json({ success: true, message: 'Site deleted' });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = deleteSite;
