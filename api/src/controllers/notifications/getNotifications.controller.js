const { Notification } = require('../../models');

const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 50, unreadOnly = false } = req.query;
    
    const query = { 
      recipient: req.user._id
    };
    
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const skip = (page - 1) * limit;
    
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate('relatedUser', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: req.user._id, read: false })
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getNotifications;

