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
import { ReportCard, ReportsTabRow, TOOLBAR_BUTTON, TOOLBAR_SELECT } from '../components/reports/ReportParts';

type ChartConfig = {
  id: string;
  title: string;
  kind: 'bar' | 'horizontal';
  format: 'currency' | 'number';
  data: { label: string; value: number }[];
};

type ReportTab = 'overview' | 'suppliers';

/** "2026-11-04" → "Nov 4", anything else returned as-is */
function fmtDateLabel(label: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const d = new Date(label + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return label.replace(/_/g, ' ');
}

/** "pending_hod" → "Pending HOD" */
function fmtStatusLabel(label: string): string {
  return label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function BarChart({ data, valueFormatter }: { data: { label: string; value: number }[]; valueFormatter?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = valueFormatter || ((v: number) => String(v));

  if (!data.length) return null;

  return (
    <div className="mt-3">
      {/* Chart area */}
      <div className="relative h-44 bg-gray-50 rounded-xl overflow-hidden">
        {/* Gridlines: absolute from bottom so they're in the right place */}
        {[25, 50, 75].map((pct) => (
          <div
            key={pct}
            className="absolute left-0 right-0 border-t border-gray-200 pointer-events-none"
            style={{ bottom: `${pct}%` }}
          />
        ))}
        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-1 px-3">
          {data.map((point) => {
            const heightPct = Math.max(4, (point.value / max) * 100);
            return (
              <div
                key={point.label}
                className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group cursor-default"
                title={`${fmtDateLabel(point.label)}: ${fmt(point.value)}`}
              >
                <span className="text-[10px] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity mb-1 whitespace-nowrap">
                  {fmt(point.value)}
                </span>
                {/* max-w caps width so a single bar doesn't become a solid block */}
                <div
                  className="w-full max-w-[40px] mx-auto bg-primary/75 group-hover:bg-primary rounded-t transition-colors"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex gap-1 px-3 mt-2">
        {data.map((point) => (
          <div key={point.label} className="flex-1 min-w-0 text-center">
            <span className="text-[9px] text-gray-400 truncate block">{fmtDateLabel(point.label)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({ data, valueFormatter }: { data: { label: string; value: number }[]; valueFormatter?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = valueFormatter || ((v: number) => String(v));

  if (!data.length) return null;

  return (
    <div className="space-y-4 mt-2">
      {data.map((row) => (
        <div key={row.label}>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-700 truncate pr-3 font-medium">{fmtStatusLabel(row.label)}</span>
            <span className="text-gray-900 font-bold shrink-0 tabular-nums">{fmt(row.value)}</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/80 rounded-full transition-all"
              style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
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
        <div className="space-y-5">
          {/* Stat tiles */}
          {reportData?.stats && (() => {
            const statEntries = Object.entries(reportData.stats).map(([key, stat]: any) => ({
              label: stat.label || key,
              value: stat.value
            }));
            if (!statEntries.length) return null;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {statEntries.map((stat) => (
                  <div key={stat.label} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                    <div className="h-1 bg-primary/30" />
                    <div className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1.5 tabular-nums">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Charts — only the ones that have data */}
          {(() => {
            const withData = charts.filter((c) => c.data.length > 0);
            if (!withData.length && charts.length > 0) {
              return (
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center text-sm text-gray-500">
                  No chart data for this period yet — data appears once activity is recorded.
                </div>
              );
            }
            if (!withData.length) return null;
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {withData.map((chart) => (
                  <ReportCard
                    key={chart.id}
                    title={chart.title}
                    className={withData.length === 1 || chart.id === 'poDistribution' ? 'lg:col-span-2' : ''}
                  >
                    {chart.kind === 'bar' ? (
                      <BarChart data={chart.data} valueFormatter={(v) => formatValue(chart.format, v)} />
                    ) : (
                      <HorizontalBars data={chart.data} valueFormatter={(v) => formatValue(chart.format, v)} />
                    )}
                  </ReportCard>
                ))}
              </div>
            );
          })()}
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
