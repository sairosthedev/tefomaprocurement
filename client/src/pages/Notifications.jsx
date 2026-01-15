import React from 'react';
import { 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  ShoppingCart,
  Clock,
  Check
} from 'lucide-react';

const notifications = [
  {
    id: 1,
    type: 'approval',
    title: 'Purchase Order Approved',
    message: 'PO-2026-00045 has been approved by Finance and is ready for COO review.',
    time: '5 minutes ago',
    read: false,
    icon: CheckCircle,
    iconColor: 'text-green-500',
    iconBg: 'bg-green-100'
  },
  {
    id: 2,
    type: 'rfq',
    title: 'New Quotation Received',
    message: 'ABC Supplies has submitted a quotation for RFQ-2026-00012.',
    time: '15 minutes ago',
    read: false,
    icon: FileText,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-100'
  },
  {
    id: 3,
    type: 'alert',
    title: 'RFQ Deadline Approaching',
    message: 'RFQ-2026-00015 submission deadline is in 2 days.',
    time: '1 hour ago',
    read: true,
    icon: Clock,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-100'
  },
  {
    id: 4,
    type: 'delivery',
    title: 'Goods Received',
    message: 'GRV-2026-00089 has been processed. All items received in good condition.',
    time: '2 hours ago',
    read: true,
    icon: ShoppingCart,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-100'
  },
  {
    id: 5,
    type: 'alert',
    title: 'Low Stock Alert',
    message: 'Office Supplies inventory is below reorder level.',
    time: '3 hours ago',
    read: true,
    icon: AlertCircle,
    iconColor: 'text-red-500',
    iconBg: 'bg-red-100'
  }
];

export default function Notifications() {
  return (
    <div className="py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1">Stay updated with system activities</p>
        </div>
        <button className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors">
          <Check className="h-4 w-4" />
          Mark all as read
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No notifications</h3>
            <p className="text-gray-500 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const Icon = notification.icon;
              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 p-5 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className={`p-3 rounded-xl ${notification.iconBg}`}>
                    <Icon className={`h-5 w-5 ${notification.iconColor}`} />
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
                    <p className="text-xs text-gray-400 mt-2">{notification.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

