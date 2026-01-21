const express = require('express');
const router = express.Router();
const { notifications } = require('../controllers');
const { protect } = require('../middleware');

// All routes require authentication
router.use(protect);

// Get notifications
router.get('/', notifications.getNotifications);
router.get('/unread-count', notifications.getUnreadCount);

// Mark notifications
router.put('/:id/read', notifications.markNotificationAsRead);
router.put('/read-all', notifications.markAllNotificationsAsRead);

module.exports = router;

