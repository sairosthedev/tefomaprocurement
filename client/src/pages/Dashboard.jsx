import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { 
  FileText, 
  ShoppingCart, 
  Users, 
  FileSearch, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  DollarSign,
  UserCheck,
  Loader2,
  RefreshCw
} from 'lucide-react';

const iconMap = {
  totalUsers: Users,
  activeUsers: UserCheck,
  totalSuppliers: Users,
  activeSuppliers: Users,
  totalPOs: ShoppingCart,
  purchaseOrders: ShoppingCart,
  openRFQs: FileSearch,
  pendingQuotations: FileText,
  quotations: FileText,
  pendingApproval: Clock,
  approved: CheckCircle,
  totalValue: DollarSign,
  pendingValue: DollarSign,
  totalItems: Package,
  lowStock: AlertCircle,
  pendingDeliveries: Package,
  myRequisitions: FileText,
  suppliers: Users,
  totalQuotations: FileText,
  approvedQuotations: CheckCircle,
  totalRFQs: FileSearch,
  approvedPOs: CheckCircle,
  monthlyValue: DollarSign,
  majorPOs: ShoppingCart,
  cooApproved: CheckCircle,
  inventoryValue: DollarSign,
  itemsNeedingReorder: AlertCircle,
  receivedThisMonth: Package,
  approvedRequisitions: CheckCircle,
  rejectedRequisitions: AlertCircle,
  departmentRequisitions: FileText,
  myQuotations: FileText,
  submittedQuotations: FileText,
  myPOs: ShoppingCart
};

const colorMap = {
  totalUsers: 'bg-blue-500',
  activeUsers: 'bg-green-500',
  totalSuppliers: 'bg-purple-500',
  activeSuppliers: 'bg-purple-500',
  totalPOs: 'bg-emerald-500',
  purchaseOrders: 'bg-emerald-500',
  openRFQs: 'bg-blue-500',
  pendingQuotations: 'bg-amber-500',
  quotations: 'bg-indigo-500',
  pendingApproval: 'bg-amber-500',
  approved: 'bg-green-500',
  totalValue: 'bg-emerald-500',
  pendingValue: 'bg-amber-500',
  totalItems: 'bg-blue-500',
  lowStock: 'bg-red-500',
  pendingDeliveries: 'bg-orange-500',
  myRequisitions: 'bg-indigo-500',
  suppliers: 'bg-purple-500',
  totalQuotations: 'bg-indigo-500',
  approvedQuotations: 'bg-green-500',
  totalRFQs: 'bg-blue-500',
  approvedPOs: 'bg-green-500',
  monthlyValue: 'bg-emerald-500',
  majorPOs: 'bg-orange-500',
  cooApproved: 'bg-green-500',
  inventoryValue: 'bg-emerald-500',
  itemsNeedingReorder: 'bg-red-500',
  receivedThisMonth: 'bg-blue-500',
  approvedRequisitions: 'bg-green-500',
  rejectedRequisitions: 'bg-red-500',
  departmentRequisitions: 'bg-indigo-500',
  myQuotations: 'bg-indigo-500',
  submittedQuotations: 'bg-blue-500',
  myPOs: 'bg-emerald-500'
};

const activityIconMap = {
  login: CheckCircle,
  create: FileText,
  update: RefreshCw,
  delete: AlertCircle,
  approve: CheckCircle,
  reject: AlertCircle,
  login_failed: AlertCircle
};

const activityColorMap = {
  login: 'text-green-500',
  create: 'text-blue-500',
  update: 'text-amber-500',
  delete: 'text-red-500',
  approve: 'text-green-500',
  reject: 'text-red-500',
  login_failed: 'text-red-500'
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [additionalStats, setAdditionalStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/dashboard/stats');
      if (response.data.success) {
        setStats(response.data.data.stats);
        setRecentActivity(response.data.data.recentActivity || []);
        setAdditionalStats(response.data.data.additionalStats || {});
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayName = (role) => {
    const names = {
      admin: 'Administrator',
      procurement_officer: 'Procurement Officer',
      department_head: 'Department Head',
      finance: 'Finance Manager',
      coo: 'Chief Operating Officer',
      stores_officer: 'Stores Officer',
      supplier: 'Supplier'
    };
    return names[role] || role;
  };

  const getQuickActions = () => {
    const actions = {
      admin: [
        { label: 'Manage Users', icon: Users, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/users' },
        { label: 'View Suppliers', icon: Users, color: 'bg-purple-50 hover:bg-purple-100 text-purple-700', href: '/app/suppliers' },
        { label: 'Purchase Orders', icon: ShoppingCart, color: 'bg-green-50 hover:bg-green-100 text-green-700', href: '/app/purchase-orders' },
        { label: 'View RFQs', icon: FileSearch, color: 'bg-blue-50 hover:bg-blue-100 text-blue-700', href: '/app/rfqs' }
      ],
      procurement_officer: [
        { label: 'Create New RFQ', icon: FileSearch, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/rfqs' },
        { label: 'Review Quotations', icon: FileText, color: 'bg-amber-50 hover:bg-amber-100 text-amber-700', href: '/app/quotations' },
        { label: 'Manage Suppliers', icon: Users, color: 'bg-purple-50 hover:bg-purple-100 text-purple-700', href: '/app/suppliers' },
        { label: 'Purchase Orders', icon: ShoppingCart, color: 'bg-green-50 hover:bg-green-100 text-green-700', href: '/app/purchase-orders' }
      ],
      finance: [
        { label: 'Pending Approvals', icon: Clock, color: 'bg-amber-50 hover:bg-amber-100 text-amber-700', href: '/app/purchase-orders' },
        { label: 'All Purchase Orders', icon: ShoppingCart, color: 'bg-green-50 hover:bg-green-100 text-green-700', href: '/app/purchase-orders' },
        { label: 'View Reports', icon: TrendingUp, color: 'bg-blue-50 hover:bg-blue-100 text-blue-700', href: '/app' }
      ],
      coo: [
        { label: 'Major PO Approvals', icon: Clock, color: 'bg-amber-50 hover:bg-amber-100 text-amber-700', href: '/app/purchase-orders' },
        { label: 'All Purchase Orders', icon: ShoppingCart, color: 'bg-green-50 hover:bg-green-100 text-green-700', href: '/app/purchase-orders' },
        { label: 'View Reports', icon: TrendingUp, color: 'bg-blue-50 hover:bg-blue-100 text-blue-700', href: '/app' }
      ],
      stores_officer: [
        { label: 'View Inventory', icon: Package, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/inventory' },
        { label: 'Pending Deliveries', icon: ShoppingCart, color: 'bg-amber-50 hover:bg-amber-100 text-amber-700', href: '/app/purchase-orders' },
        { label: 'Stock Alerts', icon: AlertCircle, color: 'bg-red-50 hover:bg-red-100 text-red-700', href: '/app/inventory' }
      ],
      department_head: [
        { label: 'Create Requisition', icon: FileText, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/requisitions' },
        { label: 'My Requisitions', icon: FileSearch, color: 'bg-blue-50 hover:bg-blue-100 text-blue-700', href: '/app/requisitions' },
        { label: 'View Reports', icon: TrendingUp, color: 'bg-green-50 hover:bg-green-100 text-green-700', href: '/app' }
      ]
    };
    return actions[user?.role] || actions.admin;
  };

  const getAdditionalStats = () => {
    // Return additional stats from API response
    // These will be displayed in place of Recent Activity for non-admin users
    return additionalStats;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Welcome Section */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-gray-500 mt-1">
            {getRoleDisplayName(user?.role)} Dashboard • {new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Object.entries(stats).map(([key, stat]) => {
          const Icon = iconMap[key] || FileText;
          const color = colorMap[key] || 'bg-gray-500';
          return (
            <div
              key={key}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${color} p-4 rounded-xl`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity (Admin only) or Additional Stats (Other roles) */}
        {user?.role === 'admin' ? (
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No recent activity</p>
                </div>
              ) : (
                recentActivity.map((activity) => {
                  const Icon = activityIconMap[activity.type] || FileText;
                  const iconColor = activityColorMap[activity.type] || 'text-gray-500';
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-gray-100">
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{activity.time}</span>
                          {activity.user && (
                            <>
                              <span className="text-xs text-gray-300">•</span>
                              <span className="text-xs text-gray-500">{activity.user}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Additional Statistics</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(getAdditionalStats()).length > 0 ? (
                Object.entries(getAdditionalStats()).map(([key, stat]) => {
                  const Icon = iconMap[key] || FileText;
                  const color = colorMap[key] || 'bg-gray-500';
                  return (
                    <div
                      key={key}
                      className="bg-gray-50 rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                          <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                        </div>
                        <div className={`${color} p-3 rounded-lg`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 text-center py-8 text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No additional statistics available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
          <div className="space-y-3">
            {getQuickActions().map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={() => navigate(action.href)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl ${action.color} transition-colors text-left`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
