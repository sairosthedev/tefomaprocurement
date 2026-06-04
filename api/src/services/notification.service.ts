import { Notification, User, SupplierProfile } from '../models/index.js';
import { sendNotificationEmail, getUserEmail } from './email.service.js';

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
}: {
  recipient: any;
  type: string;
  title: string;
  message: string;
  entity: string;
  entityId: any;
  relatedUser?: any;
  metadata?: any;
}): Promise<any> => {
  try {
    const recipientId = typeof recipient === 'object' ? recipient._id : recipient;

    const notification = await Notification.create({
      recipient: recipientId,
      type,
      title,
      message,
      entity,
      entityId,
      relatedUser: relatedUser ? (typeof relatedUser === 'object' ? relatedUser._id : relatedUser) : null,
      metadata
    });

    // Send email notification asynchronously (don't wait)
    sendEmailForNotification(notification).catch(err => {
      console.error('Failed to send email notification:', err);
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

/**
 * Send email for a notification
 */
const sendEmailForNotification = async (notification: any): Promise<void> => {
  try {
    const populatedNotification = await Notification.findById(notification._id || notification)
      .populate('recipient', 'email firstName lastName');

    if (populatedNotification) {
      await sendNotificationEmail(populatedNotification);
    }
  } catch (error) {
    console.error('Error sending email for notification:', error);
  }
};

/**
 * Create notifications for multiple recipients
 */
const createNotifications = async (recipients: any[], notificationData: any): Promise<void> => {
  try {
    const notificationPromises = recipients.map(recipient =>
      createNotification({
        ...notificationData,
        recipient: recipient._id || recipient
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
const notifyUsersByRole = async (roles: any, notificationData: any): Promise<void> => {
  try {
    const users = await User.find({
      role: { $in: Array.isArray(roles) ? roles : [roles] },
      status: 'active',
      isDeleted: false
    }).select('_id email firstName lastName');

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
const notifyUsersByDepartment = async (departmentId: any, notificationData: any, excludeUserId: any = null): Promise<void> => {
  try {
    const query: any = {
      department: departmentId,
      status: 'active',
      isDeleted: false
    };

    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }

    const users = await User.find(query).select('_id email firstName lastName');

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
const notifySupplier = async (supplierId: any, notificationData: any): Promise<void> => {
  try {
    // Get supplier profile to find associated user
    const supplierProfile = await SupplierProfile.findById(supplierId);
    if (!supplierProfile || !supplierProfile.user) {
      console.warn(`No user found for supplier ${supplierId}`);
      return;
    }

    const user = await User.findById(supplierProfile.user)
      .select('_id email firstName lastName')
      .where({ status: 'active', isDeleted: false });

    if (user) {
      // Add metadata to indicate this is a supplier notification
      const enrichedData = {
        ...notificationData,
        metadata: {
          ...notificationData.metadata,
          isSupplier: true
        }
      };

      await createNotification({
        ...enrichedData,
        recipient: user._id
      });
    }
  } catch (error) {
    console.error('Error notifying supplier:', error);
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (notificationId: any, userId: any): Promise<void> => {
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
const markAllAsRead = async (userId: any): Promise<void> => {
  try {
    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true, readAt: new Date() }
    );
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

export {
  createNotification,
  createNotifications,
  notifyUsersByRole,
  notifyUsersByDepartment,
  notifySupplier,
  markAsRead,
  markAllAsRead
};
