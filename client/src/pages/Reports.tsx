import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { canViewSupplierReports } from '../lib/reportAccess';
import PageHeader from '../components/PageHeader';
import SupplierReportsSection from '../components/reports/SupplierReportsSection';
import { ReportCard, ReportsTabRow, StatStrip, TOOLBAR_BUTTON, TOOLBAR_SELECT } from '../components/reports/ReportParts';

type ChartConfig = {
  id: string;
  title: string;
  kind: 'bar' | 'horizontal';
  format: 'currency' | 'number';
  data: { label: string; value: number }[];
};

type ReportTab = 'overview' | 'suppliers';

function BarChart({ data, valueFormatter }: { data: { label: string; value: number }[]; valueFormatter?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = valueFormatter || ((v: number) => String(v));

  if (!data.length) {
    return <p className="text-sm text-gray-400 text-center py-10">No data in this period</p>;
  }

  return (
    <div className="h-56 flex items-end gap-1.5 px-2">
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
    return <p className="text-sm text-gray-400 text-center py-10">No data in this period</p>;
  }

  return (
    <div className="space-y-2.5">
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

function OverviewReportsSection({
  tabs,
  dateRange,
  onDateRangeChange
}: {
  tabs?: React.ReactNode;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

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
    if (raw?.spendTrend) {
      return [
        { id: 'spendTrend', title: 'Spend trend', kind: 'bar', format: 'currency', data: raw.spendTrend },
        { id: 'departmentSpend', title: 'Department spend', kind: 'horizontal', format: 'currency', data: raw.departmentSpend || [] },
        { id: 'poDistribution', title: 'PO value by status', kind: 'horizontal', format: 'currency', data: raw.distribution || [] }
      ];
    }
    return [];
  }, [reportData?.chartData]);

  const formatValue = (format: 'currency' | 'number', v: number) =>
    format === 'currency' ? formatCurrency(v, reportData?.currency || getCurrentSbuCurrency()) : String(v);

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

  return (
    <div>
      <ReportsTabRow tabs={tabs}>
        <select value={dateRange} onChange={(e) => onDateRangeChange(e.target.value)} className={TOOLBAR_SELECT}>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
        <button type="button" onClick={exportCsv} disabled={loading} className={`${TOOLBAR_BUTTON} disabled:opacity-50`}>
          <Download className="h-4 w-4" />
          Export
        </button>
      </ReportsTabRow>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {reportData?.stats && (
            <StatStrip
              stats={Object.entries(reportData.stats).map(([key, stat]: any) => ({
                label: stat.label || key,
                value: stat.value
              }))}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {charts.map((chart) => (
              <ReportCard
                key={chart.id}
                title={chart.title}
                className={charts.length === 1 || chart.id === 'poDistribution' ? 'lg:col-span-2' : ''}
              >
                {chart.kind === 'bar' ? (
                  <BarChart data={chart.data} valueFormatter={(v) => formatValue(chart.format, v)} />
                ) : (
                  <HorizontalBars data={chart.data} valueFormatter={(v) => formatValue(chart.format, v)} />
                )}
              </ReportCard>
            ))}
            {charts.length === 0 && (
              <p className="lg:col-span-2 bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center text-sm text-gray-500">
                No chart data for this period.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateRange, setDateRange] = useState('month');
  const showSupplierReports = canViewSupplierReports(user);

  const requestedTab = searchParams.get('tab');
  const activeTab: ReportTab =
    showSupplierReports && requestedTab === 'suppliers' ? 'suppliers' : 'overview';

  const setActiveTab = (tab: ReportTab) => {
    if (tab === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: 'suppliers' });
    }
  };

  const subtitle =
    activeTab === 'suppliers'
      ? 'Supplier registry, spend, compliance, and evaluation insights.'
      : 'Spend trends and operational statistics.';

  // Shown only to those who see both tabs; each tab puts its own controls beside them.
  const tabs = showSupplierReports ? (
    <div className="flex gap-2">
      {([
        { id: 'overview' as const, label: 'Overview' },
        { id: 'suppliers' as const, label: 'Suppliers' }
      ]).map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="p-8">
      <PageHeader title="Reports & Analytics" subtitle={subtitle} bottomSpacing="mb-4" />

      {activeTab === 'overview' ? (
        <OverviewReportsSection tabs={tabs} dateRange={dateRange} onDateRangeChange={setDateRange} />
      ) : (
        <SupplierReportsSection tabs={tabs} />
      )}
    </div>
  );
}
