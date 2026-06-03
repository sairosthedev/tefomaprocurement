import http from './http';

export const notificationsAPI = {
  getNotifications: (params) => http.get('/notifications', { params }),
  getUnreadCount: () => http.get('/notifications/unread-count'),
  markAsRead: (id) => http.put(`/notifications/${id}/read`),
  markAllAsRead: () => http.put('/notifications/read-all')
};
