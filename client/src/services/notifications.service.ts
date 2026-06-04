import http from './http';

export const notificationsAPI = {
  getNotifications: (params?: any) => http.get('/notifications', { params }),
  getUnreadCount: () => http.get('/notifications/unread-count'),
  markAsRead: (id: any) => http.put(`/notifications/${id}/read`),
  markAllAsRead: () => http.put('/notifications/read-all')
};
