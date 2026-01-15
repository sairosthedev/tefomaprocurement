import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  ShoppingCart, 
  Users, 
  FileSearch, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const stats = [
  { name: 'Active RFQs', value: '12', icon: FileSearch, color: 'bg-blue-500' },
  { name: 'Pending Approvals', value: '8', icon: Clock, color: 'bg-amber-500' },
  { name: 'Purchase Orders', value: '24', icon: ShoppingCart, color: 'bg-green-500' },
  { name: 'Active Suppliers', value: '156', icon: Users, color: 'bg-purple-500' },
];

const recentActivity = [
  { id: 1, type: 'approval', message: 'PO-2026-00045 approved by Finance', time: '5 min ago', icon: CheckCircle, iconColor: 'text-green-500' },
  { id: 2, type: 'rfq', message: 'New quotation received for RFQ-2026-00012', time: '15 min ago', icon: FileText, iconColor: 'text-blue-500' },
  { id: 3, type: 'alert', message: 'Low stock alert: Office Supplies', time: '1 hour ago', icon: AlertCircle, iconColor: 'text-amber-500' },
  { id: 4, type: 'order', message: 'GRV-2026-00089 completed', time: '2 hours ago', icon: CheckCircle, iconColor: 'text-green-500' },
];

export default function Dashboard() {
  const { user } = useAuth();

  const getRoleDisplayName = (role) => {
    const names = {
      admin: 'Administrator',
      procurement_officer: 'Procurement Officer',
      department_head: 'Department Head',
      finance: 'Finance',
      coo: 'COO',
      stores_officer: 'Stores Officer',
      supplier: 'Supplier'
    };
    return names[role] || role;
  };

  return (
    <div className="py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-500 mt-1">
          {getRoleDisplayName(user?.role)} Dashboard • {new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-4 rounded-xl`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <button className="text-sm text-primary hover:text-primary-dark font-medium">
              View all
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity) => {
              const Icon = activity.icon;
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className={`p-2 rounded-lg bg-gray-100`}>
                    <Icon className={`h-5 w-5 ${activity.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary transition-colors text-left">
              <FileSearch className="h-5 w-5" />
              <span className="font-medium">Create New RFQ</span>
            </button>
            <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 transition-colors text-left">
              <ShoppingCart className="h-5 w-5" />
              <span className="font-medium">View Purchase Orders</span>
            </button>
            <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors text-left">
              <Users className="h-5 w-5" />
              <span className="font-medium">Manage Suppliers</span>
            </button>
            <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors text-left">
              <TrendingUp className="h-5 w-5" />
              <span className="font-medium">View Reports</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

