import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Download,
  Loader2,
  Search,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { getCategoryName } from '@fossil/shared';
import TableSkeleton from '../TableSkeleton';
import { ReportCard, ReportsTabRow, StatStrip, TOOLBAR_BUTTON, TOOLBAR_SELECT } from './ReportParts';
import { formatCurrency } from '../../lib/constants';
import { getCurrentSbuCurrency } from '../../lib/sbu';
import { procurementAPI } from '../../services/procurement.service';
import { useToast } from '../Toast';
import Pagination from '../Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  dormant: 'Dormant',
  blacklisted: 'Blacklisted'
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  dormant: 'bg-gray-100 text-gray-700',
  blacklisted: 'bg-red-100 text-red-700'
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-ZA');
}

export default function SupplierReportsSection({ tabs }: { tabs?: React.ReactNode }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [searchInput, setSearch] = useState('');
  // The box shows what's typed; the list is fetched once typing pauses.
  const search = useDebouncedValue(searchInput);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [page, limit, search, statusFilter]);

  const load = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getSupplierReports({
        page,
        limit,
        search,
        status: statusFilter || undefined
      });
      setReport(response.data.data);
      setPagination(parsePagination(response.data.pagination));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load supplier reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  const summary = report?.summary;
  const registry = report?.registry || [];

  // Every supplier matching the filters, not just the page on screen; the
  // report endpoint pages at 100 at most.
  const handleExport = async () => {
    try {
      setExporting(true);
      const rowsToExport: any[] = [];
      let nextPage = 1;
      let pages = 1;
      do {
        const response = await procurementAPI.getSupplierReports({
          page: nextPage,
          limit: 100,
          search,
          status: statusFilter || undefined
        });
        rowsToExport.push(...(response.data.data?.registry || []));
        pages = parsePagination(response.data.pagination).pages || 1;
        nextPage += 1;
      } while (nextPage <= pages);

      const headers = [
        'Supplier',
        'Registration',
        'Status',
        'KYS Verified',
        'Overall Score',
        'PO Count',
        'PO Spend',
        'Evaluations',
        'Last Evaluation',
        'Next Review Due',
        'Categories'
      ];

      const rows = rowsToExport.map((row: any) => [
        row.companyName || '',
        row.registrationNumber || '',
        row.status || '',
        row.kysComplete ? 'Yes' : 'No',
        row.overallScore || 0,
        row.poCount || 0,
        row.poSpend || 0,
        row.evaluationCount || 0,
        formatDate(row.lastEvaluationAt),
        formatDate(row.nextEvaluationDue),
        (row.categories || []).map((c: string) => getCategoryName(c)).join('; ')
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map((value: string | number) => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `supplier-reports-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to export supplier reports', 'error');
    } finally {
      setExporting(false);
    }
  };

  const links = [
    { label: 'Performance', href: '/app/suppliers/analytics/performance', icon: TrendingUp },
    { label: 'Compliance', href: '/app/suppliers/analytics/compliance', icon: ShieldCheck },
    { label: 'Evaluations', href: '/app/suppliers/evaluations', icon: ClipboardList }
  ];

  const listRow = 'w-full flex items-center justify-between gap-3 py-2 text-sm';
  const th = 'text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap';
  const td = 'py-2 px-3 border-b border-gray-100';

  return (
    <div>
      <ReportsTabRow tabs={tabs}>
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <button key={link.href} type="button" onClick={() => navigate(link.href)} className={TOOLBAR_BUTTON}>
              <Icon className="h-4 w-4" />
              {link.label}
            </button>
          );
        })}
      </ReportsTabRow>

      {/* The first load only; later loads keep the filters on screen. */}
      {loading && !report ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {summary && (
            <StatStrip
              stats={[
                { label: 'Total suppliers', value: summary.totalSuppliers },
                { label: 'KYS verified', value: summary.kysVerified, tone: 'text-emerald-600' },
                { label: 'PO spend (approved+)', value: formatCurrency(summary.totalPoSpend, getCurrentSbuCurrency()) },
                { label: 'Due for review', value: summary.dueForReview, tone: 'text-amber-600' }
              ]}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <ReportCard title="Status breakdown">
              <ul className="divide-y divide-gray-100">
                {(report?.byStatus || []).map((item: any) => (
                  <li key={item.status} className={listRow}>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                    <span className="font-semibold text-gray-900">{item.count}</span>
                  </li>
                ))}
              </ul>
            </ReportCard>

            <ReportCard title="Top suppliers by spend">
              <ul className="divide-y divide-gray-100">
                {(report?.topBySpend || []).slice(0, 6).map((row: any) => (
                  <li key={row.supplierId}>
                    <button type="button" onClick={() => navigate(`/app/suppliers/${row.supplierId}`)} className={`${listRow} text-left hover:text-primary`}>
                      <span className="font-medium truncate">{row.companyName}</span>
                      <span className="font-semibold text-gray-700 shrink-0">{formatCurrency(row.totalSpend, getCurrentSbuCurrency())}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {(report?.topBySpend || []).length === 0 && (
                <p className="text-sm text-gray-500 py-2">No approved purchase orders yet.</p>
              )}
            </ReportCard>

            <ReportCard title="Top suppliers by score">
              <ul className="divide-y divide-gray-100">
                {(report?.topByScore || []).slice(0, 6).map((row: any) => (
                  <li key={row.supplierId}>
                    <button type="button" onClick={() => navigate(`/app/suppliers/${row.supplierId}`)} className={`${listRow} text-left hover:text-primary`}>
                      <span className="font-medium truncate">{row.companyName}</span>
                      <span className="font-semibold text-primary shrink-0">{row.score}/5</span>
                    </button>
                  </li>
                ))}
              </ul>
              {(report?.topByScore || []).length === 0 && (
                <p className="text-sm text-gray-500 py-2">No evaluation scores recorded yet.</p>
              )}
            </ReportCard>
          </div>

          <section>
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Supplier registry <span className="font-normal text-gray-500">· {pagination.total} suppliers</span>
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:ml-auto">
                <div className="relative w-full sm:w-52">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search suppliers..."
                    className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={TOOLBAR_SELECT}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="dormant">Dormant</option>
                  <option value="blacklisted">Blacklisted</option>
                </select>
                <button type="button" onClick={handleExport} disabled={exporting} className={`${TOOLBAR_BUTTON} disabled:opacity-50`}>
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Supplier</th>
                    <th className={th}>Status</th>
                    <th className={th}>KYS</th>
                    <th className={th}>Score</th>
                    <th className={th}>POs</th>
                    <th className={th}>Spend</th>
                    <th className={th}>Evaluations</th>
                    <th className={th}>Next review</th>
                  </tr>
                </thead>
                {loading ? (
                  <TableSkeleton cols={8} />
                ) : registry.length === 0 ? (
                  <tbody>
                    <tr><td colSpan={8} className="text-center py-12 text-gray-500">No suppliers match your filters.</td></tr>
                  </tbody>
                ) : (
                  <tbody>
                    {registry.map((row: any) => (
                      <tr
                        key={row._id}
                        className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors cursor-pointer"
                        onClick={() => navigate(`/app/suppliers/${row._id}`)}
                      >
                        <td className={td}>
                          <p className="font-medium text-gray-900">{row.companyName}</p>
                          {row.registrationNumber && (
                            <p className="text-xs text-gray-500">{row.registrationNumber}</p>
                          )}
                        </td>
                        <td className={td}>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-700'}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className={td}>
                          {row.kysComplete ? (
                            <span className="text-emerald-600 font-medium">Verified</span>
                          ) : row.kysExempt ? (
                            <span className="text-amber-600 font-medium">Exempt</span>
                          ) : (
                            <span className="text-gray-500">Pending</span>
                          )}
                        </td>
                        <td className={`${td} font-medium text-gray-900`}>{row.overallScore ? `${row.overallScore}/5` : '—'}</td>
                        <td className={`${td} text-gray-700`}>{row.poCount}</td>
                        <td className={`${td} text-gray-700`}>{formatCurrency(row.poSpend || 0, getCurrentSbuCurrency())}</td>
                        <td className={`${td} text-gray-700`}>{row.evaluationCount}</td>
                        <td className={td}>
                          <span className={row.reviewOverdue ? 'text-amber-600 font-medium' : 'text-gray-600'}>
                            {formatDate(row.nextEvaluationDue)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>

            {!loading && (
              <Pagination
                page={page}
                pages={pagination.pages}
                total={pagination.total}
                onPageChange={setPage}
                pageSize={limit}
                onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
                itemLabel="suppliers"
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
