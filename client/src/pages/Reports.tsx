import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { 
  BarChart3, TrendingUp, DollarSign, Package, Users, 
  FileText, Download, Calendar, Loader2, PieChart
} from 'lucide-react';
import { formatCurrency } from '../lib/constants';

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [dateRange, setDateRange] = useState('month');

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/stats', { params: { range: dateRange } });
      if (response.data.success) {
        setReportData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleSpecificReports = () => {
    switch (user?.role) {
      case 'department_head':
        return [
          { title: 'Department Spend', icon: DollarSign, color: 'bg-green-500' },
          { title: 'Items Requested', icon: Package, color: 'bg-blue-500' },
          { title: 'Requisition Status', icon: FileText, color: 'bg-amber-500' }
        ];
      case 'procurement_officer':
        return [
          { title: 'Procurement Analytics', icon: TrendingUp, color: 'bg-primary' },
          { title: 'Supplier Performance', icon: Users, color: 'bg-purple-500' },
          { title: 'RFQ Statistics', icon: FileText, color: 'bg-blue-500' },
          { title: 'PO Summary', icon: DollarSign, color: 'bg-green-500' }
        ];
      case 'finance':
        return [
          { title: 'Spend by Department', icon: PieChart, color: 'bg-blue-500' },
          { title: 'Spend by Supplier', icon: Users, color: 'bg-purple-500' },
          { title: 'Monthly Commitments', icon: Calendar, color: 'bg-amber-500' },
          { title: 'Budget Utilization', icon: DollarSign, color: 'bg-green-500' }
        ];
      case 'coo':
        return [
          { title: 'Total Spend Overview', icon: DollarSign, color: 'bg-green-500' },
          { title: 'Top Suppliers', icon: Users, color: 'bg-purple-500' },
          { title: 'Department Spend', icon: PieChart, color: 'bg-blue-500' },
          { title: 'Procurement Performance', icon: TrendingUp, color: 'bg-primary' }
        ];
      case 'stores_officer':
        return [
          { title: 'Stock Valuation', icon: DollarSign, color: 'bg-green-500' },
          { title: 'Fast-Moving Items', icon: TrendingUp, color: 'bg-blue-500' },
          { title: 'Slow-Moving Items', icon: Package, color: 'bg-amber-500' },
          { title: 'Stock Movements', icon: BarChart3, color: 'bg-purple-500' }
        ];
      default:
        return [
          { title: 'Overview', icon: BarChart3, color: 'bg-primary' },
          { title: 'Spend Analysis', icon: DollarSign, color: 'bg-green-500' },
          { title: 'Performance', icon: TrendingUp, color: 'bg-blue-500' }
        ];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500 mt-1">View detailed insights and statistics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {getRoleSpecificReports().map((report, index) => {
          const Icon = report.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className={`${report.color} p-3 rounded-xl`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{report.title}</p>
                  <p className="text-lg font-semibold text-gray-900">View Report</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      {reportData?.stats && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Object.entries(reportData.stats).map(([key, stat]) => (
              <div key={key} className="text-center">
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spend Trend</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl">
            <div className="text-center text-gray-400">
              <TrendingUp className="h-12 w-12 mx-auto mb-2" />
              <p>Chart visualization coming soon</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribution</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl">
            <div className="text-center text-gray-400">
              <PieChart className="h-12 w-12 mx-auto mb-2" />
              <p>Chart visualization coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

