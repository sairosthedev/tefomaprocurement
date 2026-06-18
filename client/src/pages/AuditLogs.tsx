import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../lib/api';
import {
  Search, FileCheck, Loader2, Download, AlertCircle,
  LogIn, LogOut, Edit, Trash2, Plus, Eye, Send, Upload,
  RefreshCw, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import ViewButton from '../components/ViewButton';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

const actionIcons: any = {
  login: LogIn,
  logout: LogOut,
  login_failed: AlertCircle,
  create: Plus,
  update: Edit,
  delete: Trash2,
  view: Eye,
  approve: FileCheck,
  reject: X,
  submit: Send,
  upload: Upload,
  download: Download,
  status_change: RefreshCw
};

const actionColors: any = {
  login: 'bg-blue-100 text-blue-600',
  logout: 'bg-gray-100 text-gray-600',
  login_failed: 'bg-red-100 text-red-600',
  create: 'bg-green-100 text-green-600',
  update: 'bg-amber-100 text-amber-600',
  delete: 'bg-red-100 text-red-600',
  view: 'bg-gray-100 text-gray-600',
  approve: 'bg-green-100 text-green-600',
  reject: 'bg-red-100 text-red-600',
  submit: 'bg-blue-100 text-blue-600',
  upload: 'bg-indigo-100 text-indigo-600',
  download: 'bg-indigo-100 text-indigo-600',
  status_change: 'bg-purple-100 text-purple-600'
};

const ACTION_OPTIONS = [
  'login', 'logout', 'login_failed', 'create', 'update', 'delete',
  'view', 'approve', 'reject', 'submit', 'upload', 'download', 'status_change'
];

const ENTITY_OPTIONS = [
  'User', 'PurchaseRequisition', 'RFQ', 'Quotation', 'PurchaseOrder',
  'SupplierProfile', 'SupplierEvaluation', 'Invoice', 'Payment',
  'Delivery', 'Inventory', 'Department', 'Site'
];

const PAGE_SIZE = 25;

const formatLabel = (s: string) =>
  s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : s;

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [error, setError] = useState<any>('');
  const [searchTerm, setSearchTerm] = useState<any>('');
  const [debouncedSearch, setDebouncedSearch] = useState<any>('');
  const [actionFilter, setActionFilter] = useState<any>('');
  const [entityFilter, setEntityFilter] = useState<any>('');
  const [startDate, setStartDate] = useState<any>('');
  const [endDate, setEndDate] = useState<any>('');
  const [page, setPage] = useState<any>(1);
  const [pagination, setPagination] = useState<any>({ total: 0, pages: 1 });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showModal, setShowModal] = useState<any>(false);
  const [exporting, setExporting] = useState<any>(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset to first page whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, actionFilter, entityFilter, startDate, endDate]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminAPI.getAuditLogs({
        search: debouncedSearch,
        action: actionFilter,
        entity: entityFilter,
        startDate,
        endDate,
        page,
        limit: PAGE_SIZE
      });
      if (response.data.success) {
        setLogs(response.data.data || []);
        setPagination(response.data.pagination || { total: 0, pages: 1 });
      }
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
      setLogs([]);
      setError(
        err.response?.data?.message || 'Failed to load audit logs. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, actionFilter, entityFilter, startDate, endDate, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('');
    setEntityFilter('');
    setStartDate('');
    setEndDate('');
  };

  const hasFilters =
    searchTerm || actionFilter || entityFilter || startDate || endDate;

  const exportCsv = async () => {
    try {
      setExporting(true);
      // Pull a larger page set for export, respecting current filters.
      const response = await adminAPI.getAuditLogs({
        search: debouncedSearch,
        action: actionFilter,
        entity: entityFilter,
        startDate,
        endDate,
        page: 1,
        limit: 200
      });
      const rows: any[] = response.data?.data || [];
      const header = ['Timestamp', 'Action', 'Entity', 'Description', 'User', 'Email', 'Role', 'IP Address'];
      const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        header.join(','),
        ...rows.map((log) =>
          [
            new Date(log.createdAt).toISOString(),
            log.action,
            log.entity,
            log.description,
            `${log.user?.firstName || ''} ${log.user?.lastName || ''}`.trim(),
            log.user?.email || log.userEmail || '',
            log.user?.role || log.userRole || '',
            log.ipAddress || ''
          ]
            .map(escape)
            .join(',')
        )
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Audit Logs"
        subtitle="Track all system activities and changes"
        actions={
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || logs.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by description, entity, or email..."
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e: any) => setActionFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Actions</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>{formatLabel(a)}</option>
            ))}
          </select>
          <select
            value={entityFilter}
            onChange={(e: any) => setEntityFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Entities</option>
            {ENTITY_OPTIONS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col md:flex-row gap-4 mt-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e: any) => setStartDate(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e: any) => setEndDate(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">{error}</p>
            <button
              type="button"
              onClick={fetchLogs}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Timestamp</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Action</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Description</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">User</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">IP Address</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log: any) => {
                  const Icon = actionIcons[log.action] || FileCheck;
                  const colorClass = actionColors[log.action] || 'bg-gray-100 text-gray-600';

                  return (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-900">
                          {new Date(log.createdAt).toLocaleDateString('en-ZA')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleTimeString('en-ZA')}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {formatLabel(log.action)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-gray-900 max-w-xs truncate">{log.description}</p>
                        <p className="text-xs text-gray-500">{log.entity}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-gray-900">
                          {log.user?.firstName} {log.user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{log.user?.email || log.userEmail || '-'}</p>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500 font-mono">
                        {log.ipAddress || '-'}
                      </td>
                      <td className="py-4 px-6">
                        <ViewButton
                          onClick={() => { setSelectedLog(log); setShowModal(true); }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && logs.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {page} of {pagination.pages} · {pagination.total} total
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p: number) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p: number) => Math.min(p + 1, pagination.pages))}
                disabled={page >= pagination.pages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Audit Log Details"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Action</label>
                <p className="font-medium text-gray-900">{formatLabel(selectedLog.action)}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Entity</label>
                <p className="font-medium text-gray-900">{selectedLog.entity}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Timestamp</label>
                <p className="text-gray-900">
                  {new Date(selectedLog.createdAt).toLocaleString('en-ZA')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">IP Address</label>
                <p className="text-gray-900 font-mono">{selectedLog.ipAddress || 'N/A'}</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500">User</label>
              <p className="text-gray-900">
                {selectedLog.user?.firstName} {selectedLog.user?.lastName}{' '}
                ({selectedLog.user?.email || selectedLog.userEmail || 'N/A'})
                {(selectedLog.user?.role || selectedLog.userRole) && (
                  <span className="text-gray-500"> · {formatLabel(selectedLog.user?.role || selectedLog.userRole)}</span>
                )}
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-500">Description</label>
              <p className="text-gray-900">{selectedLog.description}</p>
            </div>

            {selectedLog.previousData && (
              <div>
                <label className="text-sm text-gray-500">Previous Data</label>
                <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto max-h-48">
                  {JSON.stringify(selectedLog.previousData, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.newData && (
              <div>
                <label className="text-sm text-gray-500">New Data</label>
                <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto max-h-48">
                  {JSON.stringify(selectedLog.newData, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.userAgent && (
              <div>
                <label className="text-sm text-gray-500">User Agent</label>
                <p className="text-gray-700 text-xs break-words">{selectedLog.userAgent}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
