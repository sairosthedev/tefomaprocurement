import type { Request, Response } from 'express';
import { Notification } from '../../models/index.js';

const getUnreadCount = async (req: Request, res: Response): Promise<any> => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user!._id,
      read: false
    });

    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getUnreadCount;
