import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { 
  BarChart3, TrendingUp, DollarSign, Package, Users, 
  FileText, Download, Calendar, Loader2, PieChart
} from 'lucide-react';
import { formatCurrency } from '../lib/constants';
import PageHeader from '../components/PageHeader';

function BarChart({ data, valueFormatter }: { data: { label: string; value: number }[]; valueFormatter?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = valueFormatter || ((v: number) => String(v));

  if (!data.length) {
    return <p className="text-sm text-gray-400 text-center py-16">No data in this period</p>;
  }

  return (
    <div className="h-64 flex items-end gap-1.5 px-2">
      {data.map((point) => (
        <div key={point.label} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group">
          <div
            className="w-full bg-primary/80 hover:bg-primary rounded-t-md transition-all min-h-[4px]"
            style={{ height: `${Math.max(4, (point.value / max) * 100)}%` }}
            title={`${point.label}: ${fmt(point.value)}`}
          />
          <span className="text-[10px] text-gray-400 mt-2 truncate w-full text-center rotate-0">
            {point.label.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({ data, valueFormatter }: { data: { label: string; value: number }[]; valueFormatter?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = valueFormatter || ((v: number) => String(v));

  if (!data.length) {
    return <p className="text-sm text-gray-400 text-center py-16">No data in this period</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((row) => (
        <div key={row.label}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700 capitalize truncate pr-2">{row.label}</span>
            <span className="text-gray-900 font-medium shrink-0">{fmt(row.value)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<any>(true);
  const [reportData, setReportData] = useState<any>(null);
  const [dateRange, setDateRange] = useState<any>('month');

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
    } catch (error: any) {
      console.error('Failed to fetch report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = reportData?.chartData;

  const exportCsv = () => {
    const rows: string[][] = [['Metric', 'Value']];
    if (reportData?.stats) {
      Object.entries(reportData.stats).forEach(([key, stat]: any) => {
        rows.push([stat.label || key, String(stat.value)]);
      });
    }
    chartData?.spendTrend?.forEach((row: any) => {
      rows.push([`Spend ${row.label}`, String(row.value)]);
    });
    chartData?.departmentSpend?.forEach((row: any) => {
      rows.push([`Dept ${row.label}`, String(row.value)]);
    });

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reports-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const summaryCards = useMemo(() => {
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
  }, [user?.role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Reports & Analytics"
        subtitle="View detailed insights and statistics"
        actions={
          <>
            <select
              value={dateRange}
              onChange={(e: any) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {summaryCards.map((report: any, index: number) => {
          const Icon = report.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-4">
                <div className={`${report.color} p-3 rounded-xl`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{report.title}</p>
                  <p className="text-lg font-semibold text-gray-900">Summary below</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {reportData?.stats && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Object.entries(reportData.stats).map(([key, stat]: any) => (
              <div key={key} className="text-center">
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spend trend</h3>
          <BarChart
            data={chartData?.spendTrend || []}
            valueFormatter={(v) => formatCurrency(v)}
          />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department spend</h3>
          <HorizontalBars
            data={chartData?.departmentSpend || []}
            valueFormatter={(v) => formatCurrency(v)}
          />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">PO value by status</h3>
          <HorizontalBars
            data={chartData?.distribution || []}
            valueFormatter={(v) => formatCurrency(v)}
          />
        </div>
      </div>
    </div>
  );
}
