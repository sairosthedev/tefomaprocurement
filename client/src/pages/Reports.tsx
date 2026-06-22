import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { 
  BarChart3, TrendingUp, DollarSign, Package, Users, 
  FileText, Download, Calendar, Loader2, PieChart
} from 'lucide-react';
import { formatCurrency } from '../lib/constants';
import PageHeader from '../components/PageHeader';

type ChartConfig = {
  id: string;
  title: string;
  kind: 'bar' | 'horizontal';
  format: 'currency' | 'number';
  data: { label: string; value: number }[];
};

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
          <span className="text-[10px] text-gray-400 mt-2 truncate w-full text-center">
            {point.label.length > 10 ? point.label.slice(5) : point.label}
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

const ROLE_CARD_CONFIG: Record<string, { title: string; icon: typeof DollarSign; color: string; statKey?: string }[]> = {
  department_head: [
    { title: 'Department Spend', icon: DollarSign, color: 'bg-green-500', statKey: 'departmentRequisitions' },
    { title: 'Items Requested', icon: Package, color: 'bg-blue-500', statKey: 'approvedRequisitions' },
    { title: 'Requisition Status', icon: FileText, color: 'bg-amber-500', statKey: 'pendingApproval' },
    { title: 'POs Pending Approval', icon: FileText, color: 'bg-purple-500', statKey: 'pendingPoApprovals' }
  ],
  procurement_officer: [
    { title: 'Procurement Analytics', icon: TrendingUp, color: 'bg-primary', statKey: 'openRFQs' },
    { title: 'Supplier Performance', icon: Users, color: 'bg-purple-500', statKey: 'activeSuppliers' },
    { title: 'RFQ Statistics', icon: FileText, color: 'bg-blue-500', statKey: 'pendingQuotations' },
    { title: 'PO Summary', icon: DollarSign, color: 'bg-green-500', statKey: 'purchaseOrders' }
  ],
  finance: [
    { title: 'Spend by Department', icon: PieChart, color: 'bg-blue-500', statKey: 'totalPOs' },
    { title: 'Spend by Supplier', icon: Users, color: 'bg-purple-500', statKey: 'approved' },
    { title: 'Monthly Commitments', icon: Calendar, color: 'bg-amber-500', statKey: 'totalValue' },
    { title: 'Budget Utilization', icon: DollarSign, color: 'bg-green-500', statKey: 'pendingApproval' }
  ],
  coo: [
    { title: 'Total Spend Overview', icon: DollarSign, color: 'bg-green-500', statKey: 'pendingValue' },
    { title: 'Top Suppliers', icon: Users, color: 'bg-purple-500', statKey: 'approved' },
    { title: 'Department Spend', icon: PieChart, color: 'bg-blue-500', statKey: 'totalPOs' },
    { title: 'Procurement Performance', icon: TrendingUp, color: 'bg-primary', statKey: 'pendingApproval' }
  ],
  stores_officer: [
    { title: 'Stock Valuation', icon: DollarSign, color: 'bg-green-500', statKey: 'totalItems' },
    { title: 'Fast-Moving Items', icon: TrendingUp, color: 'bg-blue-500', statKey: 'purchaseOrders' },
    { title: 'Low Stock Items', icon: Package, color: 'bg-amber-500', statKey: 'lowStock' },
    { title: 'Pending Deliveries', icon: BarChart3, color: 'bg-purple-500', statKey: 'pendingDeliveries' }
  ],
  end_user: [
    { title: 'My Requisitions', icon: FileText, color: 'bg-primary', statKey: 'myRequisitions' },
    { title: 'Drafts', icon: Package, color: 'bg-gray-500', statKey: 'drafts' },
    { title: 'Awaiting Approval', icon: Calendar, color: 'bg-amber-500', statKey: 'pendingApproval' },
    { title: 'Fulfilled', icon: TrendingUp, color: 'bg-green-500', statKey: 'fulfilled' }
  ],
  supplier: [
    { title: 'My RFQs', icon: FileText, color: 'bg-blue-500', statKey: 'myRFQs' },
    { title: 'My Quotations', icon: Package, color: 'bg-purple-500', statKey: 'myQuotations' },
    { title: 'Submitted', icon: TrendingUp, color: 'bg-amber-500', statKey: 'submittedQuotations' },
    { title: 'My Purchase Orders', icon: DollarSign, color: 'bg-green-500', statKey: 'myPOs' }
  ]
};

export default function Reports() {
  const { user } = useAuth();
  const { showToast } = useToast();
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
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load report data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const charts: ChartConfig[] = useMemo(() => {
    const raw = reportData?.chartData;
    if (Array.isArray(raw)) return raw;
    // Legacy shape fallback
    if (raw?.spendTrend) {
      return [
        { id: 'spendTrend', title: 'Spend trend', kind: 'bar', format: 'currency', data: raw.spendTrend },
        { id: 'departmentSpend', title: 'Department spend', kind: 'horizontal', format: 'currency', data: raw.departmentSpend || [] },
        { id: 'poDistribution', title: 'PO value by status', kind: 'horizontal', format: 'currency', data: raw.distribution || [] }
      ];
    }
    return [];
  }, [reportData?.chartData]);

  const summaryCards = useMemo(() => {
    const config = ROLE_CARD_CONFIG[user?.role || ''] || [
      { title: 'Overview', icon: BarChart3, color: 'bg-primary', statKey: 'openRFQs' },
      { title: 'Spend Analysis', icon: DollarSign, color: 'bg-green-500', statKey: 'purchaseOrders' },
      { title: 'Performance', icon: TrendingUp, color: 'bg-blue-500', statKey: 'quotations' }
    ];
    const stats = reportData?.stats || {};
    return config.map((card) => ({
      ...card,
      value: card.statKey && stats[card.statKey] ? stats[card.statKey].value : '—'
    }));
  }, [user?.role, reportData?.stats]);

  const formatValue = (format: 'currency' | 'number', v: number) =>
    format === 'currency' ? formatCurrency(v) : String(v);

  const exportCsv = () => {
    const rows: string[][] = [['Metric', 'Value']];
    if (reportData?.stats) {
      Object.entries(reportData.stats).forEach(([key, stat]: any) => {
        rows.push([stat.label || key, String(stat.value)]);
      });
    }
    charts.forEach((chart) => {
      chart.data.forEach((row) => {
        rows.push([`${chart.title}: ${row.label}`, String(row.value)]);
      });
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
              onChange={(e) => setDateRange(e.target.value)}
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
        {summaryCards.map((report, index) => {
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
                  <p className="text-lg font-semibold text-gray-900">{report.value}</p>
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
        {charts.map((chart) => (
          <div
            key={chart.id}
            className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${
              charts.length === 1 || chart.id === 'poDistribution' ? 'lg:col-span-2' : ''
            }`}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{chart.title}</h3>
            {chart.kind === 'bar' ? (
              <BarChart
                data={chart.data}
                valueFormatter={(v) => formatValue(chart.format, v)}
              />
            ) : (
              <HorizontalBars
                data={chart.data}
                valueFormatter={(v) => formatValue(chart.format, v)}
              />
            )}
          </div>
        ))}
        {charts.length === 0 && (
          <div className="lg:col-span-2 bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center text-gray-500">
            No chart data for this period.
          </div>
        )}
      </div>
    </div>
  );
}
