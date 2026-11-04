import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isProcurementHead } from '@fossil/shared';
import api from '../lib/api';
import PageHeader from '../components/PageHeader';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  FileText,
  Users,
  FileSearch,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  ClipboardList,
  FileCheck,
  Package,
  DollarSign
} from 'lucide-react';

const activityIconMap: any = {
  login: CheckCircle,
  create: FileText,
  update: RefreshCw,
  delete: AlertCircle,
  approve: CheckCircle,
  reject: AlertCircle,
  login_failed: AlertCircle
};

const activityColorMap: any = {
  login: 'text-green-500',
  create: 'text-blue-500',
  update: 'text-amber-500',
  delete: 'text-red-500',
  approve: 'text-green-500',
  reject: 'text-red-500',
  login_failed: 'text-red-500'
};

const attentionSeverityStyles: Record<string, string> = {
  high: 'border-red-200 bg-red-50 hover:bg-red-100',
  medium: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
  low: 'border-gray-200 bg-gray-50 hover:bg-gray-100'
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({});
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [additionalStats, setAdditionalStats] = useState<any>({});
  const [attentionItems, setAttentionItems] = useState<any[]>([]);
  const attentionTotal = attentionItems.reduce((sum: number, item: any) => sum + (Number(item.count) || 0), 0);
  const [loading, setLoading] = useState<any>(true);
  const [error, setError] = useState<any>(null);

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
        setAttentionItems(response.data.data.attentionItems || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const procurementHead = isProcurementHead(user);
  const effectiveRole = procurementHead ? 'procurement_officer' : user?.role;

  const getRoleDisplayName = (role: any) => {
    if (procurementHead) return 'Head of Procurement';
    const names: any = {
      admin: 'Administrator',
      procurement_officer: 'Procurement Officer',
      department_head: 'Department Head',
      end_user: 'End User',
      finance: 'Finance Manager',
      coo: 'Chief Operating Officer',
      stores_officer: 'Stores Officer',
      supplier: 'Supplier'
    };
    return names[role] || role;
  };

  const getQuickActions = () => {
    const actions: any = {
      admin: [
        { label: 'Manage Users', icon: Users, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/users' },
        { label: 'Supplier Compliance', icon: ShieldCheck, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/suppliers/analytics/compliance' },
        { label: 'Supplier Evaluations', icon: ClipboardList, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/suppliers/evaluations' },
        { label: 'Audit Logs', icon: FileCheck, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/audit-logs' },
        { label: 'Reports', icon: BarChart3, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/reports' }
      ],
      procurement_officer: [
        { label: 'Create New RFQ', icon: FileSearch, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/rfqs' },
        { label: 'Review Quotations', icon: FileText, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/quotations' },
        { label: 'Manage Suppliers', icon: Users, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/suppliers' },
        { label: 'Purchase Orders', icon: ShoppingCart, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/purchase-orders' }
      ],
      finance: [
        { label: 'Pending Approvals', icon: Clock, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/approvals' },
        { label: 'Invoices', icon: FileText, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/invoices' },
        { label: 'All Purchase Orders', icon: ShoppingCart, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/purchase-orders' },
        { label: 'View Reports', icon: TrendingUp, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/reports' }
      ],
      coo: [
        { label: 'Major PO Approvals', icon: Clock, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/approvals' },
        { label: 'Suppliers', icon: Users, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/suppliers' },
        { label: 'View Reports', icon: TrendingUp, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/reports' }
      ],
      stores_officer: [
        { label: 'View Inventory', icon: Package, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/inventory' },
        { label: 'Pending Deliveries', icon: ShoppingCart, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/deliveries' },
        { label: 'Stock Alerts', icon: AlertCircle, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/inventory' }
      ],
      department_head: [
        { label: 'Pending Approvals', icon: Clock, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/approvals' },
        { label: 'Create Requisition', icon: FileText, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/requisitions?new=1' },
        { label: 'Department Requisitions', icon: FileSearch, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/requisitions' },
        { label: 'View Reports', icon: TrendingUp, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/reports' }
      ],
      end_user: [
        { label: 'Create Requisition', icon: FileText, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/requisitions?new=1' },
        { label: 'My Requisitions', icon: FileSearch, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/requisitions' }
      ],
      supplier: [
        { label: 'My RFQs', icon: FileSearch, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/my-rfqs' },
        { label: 'My Purchase Orders', icon: ShoppingCart, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/my-purchase-orders' },
        { label: 'My Invoices', icon: DollarSign, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/my-invoices' },
        { label: 'KYS Documents', icon: ShieldCheck, color: 'bg-primary/5 hover:bg-primary/10 text-primary', href: '/app/my-kys' }
      ]
    };
    // No fallback to another role's list: an unknown role gets no shortcuts
    // rather than buttons into pages it cannot open.
    return actions[effectiveRole] || [];
  };

  const getAdditionalStats = () => {
    // Return additional stats from API response
    // These will be displayed in place of Recent Activity for non-admin users
    return additionalStats;
  };

  const renderStatCard = (key: string, stat: any) => {
    const className =
      'bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left w-full';
    const content = (
      <>
        <p className="text-sm font-medium text-gray-500">{stat.label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
      </>
    );

    if (stat.href) {
      return (
        <button key={key} type="button" onClick={() => navigate(stat.href)} className={className}>
          {content}
        </button>
      );
    }

    return (
      <div key={key} className={className}>
        {content}
      </div>
    );
  };

  const isAdmin = user?.role === 'admin';

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
      <PageHeader
        title={`Welcome back, ${user?.firstName}!`}
        subtitle={`${getRoleDisplayName(user?.role)} Dashboard • ${new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
        actions={
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {Object.entries(stats).map(([key, stat]: any) => renderStatCard(key, stat))}
      </div>

      {isAdmin && Object.keys(additionalStats).length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {Object.entries(additionalStats).map(([key, stat]: any) => {
              const inner = (
                <>
                  <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </>
              );
              if (stat.href) {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigate(stat.href)}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left w-full"
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {effectiveRole === 'procurement_officer' && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Requisition pipeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button type="button" onClick={() => navigate('/app/requisitions?status=pending_acceptance')} className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left hover:bg-amber-100 transition-colors">
              <p className="text-sm text-amber-600 font-medium">Pending Acceptance</p>
              <p className="text-2xl font-bold text-amber-700">{additionalStats.pendingAcceptance?.value ?? 0}</p>
            </button>
            <button type="button" onClick={() => navigate('/app/requisitions?status=accepted')} className="bg-green-50 border border-green-200 rounded-xl p-4 text-left hover:bg-green-100 transition-colors">
              <p className="text-sm text-green-600 font-medium">Accepted</p>
              <p className="text-2xl font-bold text-green-700">{additionalStats.acceptedRequisitions?.value ?? 0}</p>
            </button>
            <button type="button" onClick={() => navigate('/app/requisitions?status=sourcing')} className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left hover:bg-blue-100 transition-colors">
              <p className="text-sm text-blue-600 font-medium">In Sourcing</p>
              <p className="text-2xl font-bold text-blue-700">{additionalStats.sourcingRequisitions?.value ?? 0}</p>
            </button>
            <button type="button" onClick={() => navigate('/app/requisitions?status=ordered')} className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-left hover:bg-purple-100 transition-colors">
              <p className="text-sm text-purple-600 font-medium">Ordered</p>
              <p className="text-2xl font-bold text-purple-700">{additionalStats.orderedRequisitions?.value ?? 0}</p>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Needs attention</h2>
              {attentionItems.length > 0 && (
                <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                  {/* The total across the rows, so it agrees with the numbers below. */}
                  {attentionTotal} item{attentionTotal === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {attentionItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-300" />
                <p className="text-sm">Nothing needs your attention right now</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attentionItems.map((item: any) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.href)}
                    className={`w-full flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors text-left ${attentionSeverityStyles[item.severity] || attentionSeverityStyles.low}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-600 mt-0.5">Click to review</p>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 tabular-nums">{item.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                <button
                  type="button"
                  onClick={() => navigate('/app/audit-logs')}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all
                </button>
              </div>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  recentActivity.map((activity: any) => {
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
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
          <div className="space-y-3">
            {getQuickActions().map((action: any, index: any) => {
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
