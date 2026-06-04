import express from 'express';
import controllers from '../controllers/index.js';
import { protect } from '../middleware/index.js';

const { notifications } = controllers;
const router = express.Router();

// All routes require authentication
router.use(protect);

// Get notifications
router.get('/', notifications.getNotifications);
router.get('/unread-count', notifications.getUnreadCount);

// Mark notifications
router.put('/:id/read', notifications.markNotificationAsRead);
router.put('/read-all', notifications.markAllNotificationsAsRead);

export default router;
