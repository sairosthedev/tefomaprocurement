import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../lib/api';
import { getNotificationPath } from '../lib/notificationRoutes';
import { 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  ShoppingCart,
  Clock,
  Check,
  Loader2,
  XCircle,
  Package,
  Truck,
  Send
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
const getNotificationIcon = (type: any) => {
  const icons: any = {
    login_successful: CheckCircle,
    supplier_added: CheckCircle,
    supplier_approved: CheckCircle,
    requisition_submitted: FileText,
    requisition_approved: CheckCircle,
    requisition_rejected: XCircle,
    requisition_accepted: CheckCircle,
    requisition_rejected_procurement: XCircle,
    rfq_published: Send,
    quotation_submitted: FileText,
    quotation_accepted: CheckCircle,
    quotation_rejected: XCircle,
    po_created: ShoppingCart,
    po_finance_approved: CheckCircle,
    po_finance_rejected: XCircle,
    po_coo_approved: CheckCircle,
    po_coo_rejected: XCircle,
    po_submitted: FileText,
    goods_received: Package,
    delivery_accepted: CheckCircle,
    delivery_rejected: XCircle,
    store_requisition_created: FileText,
    store_requisition_approved: CheckCircle,
    store_requisition_rejected: XCircle,
    stock_issued: Truck,
    low_stock: AlertCircle,
    rfq_deadline_approaching: Clock
  };
  return icons[type] || Bell;
};

const getNotificationColors = (type: any) => {
  const colors: any = {
    login_successful: { icon: 'text-green-500', bg: 'bg-green-100' },
    supplier_added: { icon: 'text-green-500', bg: 'bg-green-100' },
    supplier_approved: { icon: 'text-green-500', bg: 'bg-green-100' },
    requisition_submitted: { icon: 'text-blue-500', bg: 'bg-blue-100' },
    requisition_approved: { icon: 'text-green-500', bg: 'bg-green-100' },
    requisition_rejected: { icon: 'text-red-500', bg: 'bg-red-100' },
    requisition_accepted: { icon: 'text-green-500', bg: 'bg-green-100' },
    requisition_rejected_procurement: { icon: 'text-red-500', bg: 'bg-red-100' },
    rfq_published: { icon: 'text-blue-500', bg: 'bg-blue-100' },
    quotation_submitted: { icon: 'text-blue-500', bg: 'bg-blue-100' },
    quotation_accepted: { icon: 'text-green-500', bg: 'bg-green-100' },
    quotation_rejected: { icon: 'text-red-500', bg: 'bg-red-100' },
    po_created: { icon: 'text-purple-500', bg: 'bg-purple-100' },
    po_finance_approved: { icon: 'text-green-500', bg: 'bg-green-100' },
    po_finance_rejected: { icon: 'text-red-500', bg: 'bg-red-100' },
    po_coo_approved: { icon: 'text-green-500', bg: 'bg-green-100' },
    po_coo_rejected: { icon: 'text-red-500', bg: 'bg-red-100' },
    po_submitted: { icon: 'text-blue-500', bg: 'bg-blue-100' },
    goods_received: { icon: 'text-purple-500', bg: 'bg-purple-100' },
    delivery_accepted: { icon: 'text-green-500', bg: 'bg-green-100' },
    delivery_rejected: { icon: 'text-red-500', bg: 'bg-red-100' },
    store_requisition_created: { icon: 'text-blue-500', bg: 'bg-blue-100' },
    store_requisition_approved: { icon: 'text-green-500', bg: 'bg-green-100' },
    store_requisition_rejected: { icon: 'text-red-500', bg: 'bg-red-100' },
    stock_issued: { icon: 'text-green-500', bg: 'bg-green-100' },
    low_stock: { icon: 'text-amber-500', bg: 'bg-amber-100' },
    rfq_deadline_approaching: { icon: 'text-amber-500', bg: 'bg-amber-100' }
  };
  return colors[type] || { icon: 'text-gray-500', bg: 'bg-gray-100' };
};

const formatTimeAgo = (date: any) => {
  const now = new Date();
  const notificationDate = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return notificationDate.toLocaleDateString('en-ZA');
  }
};

export default function Notifications() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [markingAll, setMarkingAll] = useState<any>(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationsAPI.getNotifications({ page, limit: DEFAULT_PAGE_SIZE });
      if (response.data.success) {
        setNotifications(response.data.data || []);
        setPagination(parsePagination(response.data.pagination));
      }
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
      showToast('Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: any) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(notifications.map((n: any) => 
        n._id === id ? { ...n, read: true, readAt: new Date() } : n
      ));
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      await notificationsAPI.markAllAsRead();
      setNotifications(notifications.map((n: any) => ({ ...n, read: true, readAt: new Date() })));
      showToast('All notifications marked as read', 'success');
    } catch (error: any) {
      console.error('Failed to mark all as read:', error);
      showToast('Failed to mark all as read', 'error');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await handleMarkAsRead(notification._id);
    }
    const path = getNotificationPath(notification, user?.role);
    if (path) {
      navigate(path);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Notifications"
        subtitle="Stay updated with system activities"
        actions={
          notifications.filter((n: any) => !n.read).length > 0 ? (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors disabled:opacity-50"
            >
              {markingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Mark all as read
            </button>
          ) : undefined
        }
      />

      {/* Notifications List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No notifications</h3>
            <p className="text-gray-500 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification: any) => {
              const Icon = getNotificationIcon(notification.type);
              const colors = getNotificationColors(notification.type);
              
              return (
                <div
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex items-start gap-4 p-5 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className={`p-3 rounded-xl ${colors.bg}`}>
                    <Icon className={`h-5 w-5 ${colors.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
                      </div>
                      {!notification.read && (
                        <span className="h-2.5 w-2.5 bg-primary rounded-full shrink-0 mt-2" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pagination
          page={page}
          pages={pagination.pages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="notifications"
        />
      </div>
    </div>
  );
}
