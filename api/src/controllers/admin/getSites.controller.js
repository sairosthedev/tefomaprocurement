const { Site } = require('../../models');

const getSites = async (req, res) => {
  try {
    const { status, type, includeInactive } = req.query;
    const query = { isDeleted: false };

    if (status) query.status = status;
    if (type) query.type = type;
    if (includeInactive !== 'true') query.status = 'active';

    const sites = await Site.find(query)
      .populate('parentSite', 'code name type')
      .populate('manager', 'firstName lastName email')
      .sort({ type: 1, name: 1 });

    res.status(200).json({ success: true, data: sites });
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = getSites;
