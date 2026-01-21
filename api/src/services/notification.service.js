const { Notification, User } = require('../models');

/**
 * Create a notification for a single user
 */
const createNotification = async ({
  recipient,
  type,
  title,
  message,
  entity,
  entityId,
  relatedUser,
  metadata
}) => {
  try {
    const notification = await Notification.create({
      recipient: typeof recipient === 'object' ? recipient._id : recipient,
      type,
      title,
      message,
      entity,
      entityId,
      relatedUser: relatedUser ? (typeof relatedUser === 'object' ? relatedUser._id : relatedUser) : null,
      metadata
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

/**
 * Create notifications for multiple recipients
 */
const createNotifications = async (recipients, notificationData) => {
  try {
    const notificationPromises = recipients.map(recipient =>
      createNotification({
        ...notificationData,
        recipient
      })
    );
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error creating notifications:', error);
  }
};

/**
 * Create notification for users by role
 */
const notifyUsersByRole = async (roles, notificationData) => {
  try {
    const users = await User.find({
      role: { $in: Array.isArray(roles) ? roles : [roles] },
      status: 'active',
      isDeleted: false
    }).select('_id');

    if (users.length > 0) {
      await createNotifications(users, notificationData);
    }
  } catch (error) {
    console.error('Error notifying users by role:', error);
  }
};

/**
 * Create notification for users by department
 */
const notifyUsersByDepartment = async (departmentId, notificationData, excludeUserId = null) => {
  try {
    const query = {
      department: departmentId,
      status: 'active',
      isDeleted: false
    };
    
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }

    const users = await User.find(query).select('_id');

    if (users.length > 0) {
      await createNotifications(users, notificationData);
    }
  } catch (error) {
    console.error('Error notifying users by department:', error);
  }
};

/**
 * Create notification for specific supplier users
 */
const notifySupplier = async (supplierId, notificationData) => {
  try {
    const users = await User.find({
      'supplierProfile': supplierId,
      status: 'active',
      isDeleted: false
    }).select('_id');

    if (users.length > 0) {
      await createNotifications(users, notificationData);
    }
  } catch (error) {
    console.error('Error notifying supplier:', error);
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (notificationId, userId) => {
  try {
    await Notification.updateOne(
      { _id: notificationId, recipient: userId },
      { read: true, readAt: new Date() }
    );
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId) => {
  try {
    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true, readAt: new Date() }
    );
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

module.exports = {
  createNotification,
  createNotifications,
  notifyUsersByRole,
  notifyUsersByDepartment,
  notifySupplier,
  markAsRead,
  markAllAsRead
};

