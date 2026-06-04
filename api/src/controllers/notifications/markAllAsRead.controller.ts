import type { Request, Response } from 'express';
import { markAllAsRead } from '../../services/notification.service.js';

const markAllNotificationsAsRead = async (req: Request, res: Response): Promise<any> => {
  try {
    await markAllAsRead(req.user!._id);

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

export default markAllNotificationsAsRead;
