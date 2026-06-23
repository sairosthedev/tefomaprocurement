import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ClipboardList,
  Download,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  TrendingUp,
  Users
} from 'lucide-react';
import { getCategoryName } from '@fossil/shared';
import { PageStatCard } from '../PageHeader';
import { formatCurrency } from '../../lib/constants';
import { procurementAPI } from '../../services/procurement.service';
import { useToast } from '../Toast';
import Pagination from '../Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination';

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

export default function SupplierReportsSection() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [page, search, statusFilter]);

  const load = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getSupplierReports({
        page,
        limit: DEFAULT_PAGE_SIZE,
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

  const handleExport = () => {
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

    const rows = registry.map((row: any) => [
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
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate('/app/suppliers')}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Users className="h-4 w-4" />
          All Suppliers
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <PageStatCard label="Total suppliers" value={summary.totalSuppliers} />
          <PageStatCard label="KYS verified" value={summary.kysVerified} valueClassName="text-emerald-600" />
          <PageStatCard label="PO spend (approved+)" value={formatCurrency(summary.totalPoSpend)} />
          <PageStatCard label="Due for review" value={summary.dueForReview} valueClassName="text-amber-600" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Status breakdown</h2>
          <div className="space-y-3">
            {(report?.byStatus || []).map((item: any) => (
              <div key={item.status} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABELS[item.status] || item.status}
                </span>
                <span className="text-lg font-semibold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Top suppliers by spend</h2>
          <div className="space-y-3">
            {(report?.topBySpend || []).slice(0, 6).map((row: any) => (
              <button
                key={row.supplierId}
                type="button"
                onClick={() => navigate(`/app/suppliers/${row.supplierId}`)}
                className="w-full flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 truncate pr-3">{row.companyName}</span>
                <span className="text-sm font-semibold text-gray-700 shrink-0">{formatCurrency(row.totalSpend)}</span>
              </button>
            ))}
            {(report?.topBySpend || []).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">No approved purchase orders yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Top suppliers by score</h2>
          <div className="space-y-3">
            {(report?.topByScore || []).slice(0, 6).map((row: any) => (
              <button
                key={row.supplierId}
                type="button"
                onClick={() => navigate(`/app/suppliers/${row.supplierId}`)}
                className="w-full flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 truncate pr-3">{row.companyName}</span>
                <span className="text-sm font-semibold text-primary shrink-0">{row.score}/5</span>
              </button>
            ))}
            {(report?.topByScore || []).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">No evaluation scores recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Performance analytics', href: '/app/suppliers/analytics/performance', icon: TrendingUp },
          { label: 'Compliance analytics', href: '/app/suppliers/analytics/compliance', icon: ShieldCheck },
          { label: 'Evaluations', href: '/app/suppliers/evaluations', icon: ClipboardList }
        ].map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.href}
              type="button"
              onClick={() => navigate(link.href)}
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-medium text-gray-900">{link.label}</span>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Supplier registry report</h2>
            <p className="text-sm text-gray-500 mt-1">{pagination.total} suppliers</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search suppliers..."
                className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-full sm:w-56 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="dormant">Dormant</option>
              <option value="blacklisted">Blacklisted</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">KYS</th>
                <th className="px-5 py-3">Score</th>
                <th className="px-5 py-3">POs</th>
                <th className="px-5 py-3">Spend</th>
                <th className="px-5 py-3">Evaluations</th>
                <th className="px-5 py-3">Next review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registry.map((row: any) => (
                <tr
                  key={row._id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/app/suppliers/${row._id}`)}
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-900">{row.companyName}</p>
                    {row.registrationNumber && (
                      <p className="text-xs text-gray-500 mt-0.5">{row.registrationNumber}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-700'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {row.kysComplete ? (
                      <span className="text-emerald-600 font-medium">Verified</span>
                    ) : row.kysExempt ? (
                      <span className="text-amber-600 font-medium">Exempt</span>
                    ) : (
                      <span className="text-gray-500">Pending</span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-medium text-gray-900">{row.overallScore ? `${row.overallScore}/5` : '—'}</td>
                  <td className="px-5 py-4 text-gray-700">{row.poCount}</td>
                  <td className="px-5 py-4 text-gray-700">{formatCurrency(row.poSpend || 0)}</td>
                  <td className="px-5 py-4 text-gray-700">{row.evaluationCount}</td>
                  <td className="px-5 py-4">
                    {row.reviewOverdue ? (
                      <span className="text-amber-600 font-medium">{formatDate(row.nextEvaluationDue)}</span>
                    ) : (
                      <span className="text-gray-600">{formatDate(row.nextEvaluationDue)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pages={pagination.pages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="suppliers"
        />

        {registry.length === 0 && (
          <div className="px-5 py-12 text-center text-gray-500">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            No suppliers match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
