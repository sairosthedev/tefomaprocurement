const { Site } = require('../../models');
const { createAuditLog } = require('../../middleware');

const updateSite = async (req, res) => {
  try {
    const site = await Site.findOne({ _id: req.params.id, isDeleted: false });
    if (!site) {
      return res.status(404).json({ success: false, message: 'Site not found' });
    }

    const fields = [
      'name',
      'type',
      'parentSite',
      'address',
      'manager',
      'hasLocalStore',
      'status'
    ];
    const previous = site.toObject();

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        site[field] = req.body[field];
      }
    });

    await site.save();

    await createAuditLog({
      action: 'update',
      entity: 'Site',
      entityId: site._id,
      user: req.user,
      description: `Updated site ${site.code}`,
      previousData: previous,
      newData: site.toObject(),
      req
    });

    res.status(200).json({ success: true, data: site });
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = updateSite;
