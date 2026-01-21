const getNotifications = require('./getNotifications.controller');
const markNotificationAsRead = require('./markAsRead.controller');
const markAllNotificationsAsRead = require('./markAllAsRead.controller');
const getUnreadCount = require('./getUnreadCount.controller');

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount
};

