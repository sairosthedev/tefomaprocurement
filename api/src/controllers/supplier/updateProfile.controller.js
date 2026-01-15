const { SupplierProfile } = require('../../models');
const { createAuditLog } = require('../../middleware');

const updateProfile = async (req, res) => {
  try {
    const { 
      tradingName, 
      address, 
      contactPersons, 
      bankDetails, 
      categories 
    } = req.body;

    const profile = await SupplierProfile.findOne({ user: req.user._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const previousData = { ...profile.toObject() };

    if (tradingName) profile.tradingName = tradingName;
    if (address) profile.address = address;
    if (contactPersons) profile.contactPersons = contactPersons;
    if (bankDetails) profile.bankDetails = bankDetails;
    if (categories) profile.categories = categories;

    await profile.save();

    await createAuditLog({
      action: 'update',
      entity: 'SupplierProfile',
      entityId: profile._id,
      user: req.user,
      description: `Supplier updated their profile`,
      previousData,
      newData: req.body,
      req
    });

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = updateProfile;

