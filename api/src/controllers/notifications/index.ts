import getNotifications from './getNotifications.controller.js';
import markNotificationAsRead from './markAsRead.controller.js';
import markAllNotificationsAsRead from './markAllAsRead.controller.js';
import getUnreadCount from './getUnreadCount.controller.js';

export default {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount
};
