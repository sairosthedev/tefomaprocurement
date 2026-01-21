const { markAllAsRead } = require('../../services/notification.service');

const markAllNotificationsAsRead = async (req, res) => {
  try {
    await markAllAsRead(req.user._id);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = markAllNotificationsAsRead;

