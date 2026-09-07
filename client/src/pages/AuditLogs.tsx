import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { adminAPI } from '../lib/api';
import {
  Search, FileCheck, Loader2, Download, AlertCircle,
  LogIn, LogOut, Edit, Trash2, Plus, Eye, Send, Upload,
  RefreshCw, X, Activity, Users, ShieldAlert, Clock,
  ArrowRight, Monitor, Globe, SlidersHorizontal
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';

const actionIcons: any = {
  login: LogIn,
  logout: LogOut,
  login_failed: ShieldAlert,
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

/** Tone per action: badge chrome, plus the rail colour used in the list. */
const actionTones: any = {
  login: { badge: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  logout: { badge: 'bg-slate-50 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
  login_failed: { badge: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  create: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  update: { badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  delete: { badge: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  view: { badge: 'bg-slate-50 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
  approve: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  reject: { badge: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  submit: { badge: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  upload: { badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' },
  download: { badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' },
  status_change: { badge: 'bg-purple-50 text-purple-700 ring-purple-200', dot: 'bg-purple-500' }
};

const toneFor = (action: string) =>
  actionTones[action] || { badge: 'bg-slate-50 text-slate-600 ring-slate-200', dot: 'bg-slate-400' };

const ACTION_OPTIONS = [
  'login', 'logout', 'login_failed', 'create', 'update', 'delete',
  'view', 'approve', 'reject', 'submit', 'upload', 'download', 'status_change'
];

const ENTITY_OPTIONS = [
  'User', 'PurchaseRequisition', 'RFQ', 'Quotation', 'PurchaseOrder',
  'SupplierProfile', 'SupplierEvaluation', 'Invoice', 'Payment',
  'Delivery', 'Inventory', 'Department', 'Site'
];

const formatLabel = (s: string) =>
  s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : s;

/** "PurchaseRequisition" -> "Purchase Requisition" */
const formatEntity = (s: string) =>
  s ? String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ') : s;

const initialsOf = (log: any) => {
  const first = log.user?.firstName?.[0];
  const last = log.user?.lastName?.[0];
  if (first || last) return `${first || ''}${last || ''}`.toUpperCase();
  const email = log.user?.email || log.userEmail;
  return email ? email.slice(0, 2).toUpperCase() : '—';
};

const userName = (log: any) => {
  const name = `${log.user?.firstName || ''} ${log.user?.lastName || ''}`.trim();
  return name || log.user?.email || log.userEmail || 'System';
};

const relativeTime = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-ZA');
};

const dayLabel = (date: string) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
};

const timeOf = (date: string) =>
  new Date(date).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

/** Render any stored value as something a human can scan in a table cell. */
const formatValue = (value: any): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value);
  // ISO timestamps read better as local dates.
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(str)) return new Date(str).toLocaleString('en-ZA');
  if (/^[0-9a-f]{24}$/i.test(str)) return str; // Mongo id — leave as-is
  return formatLabel(str);
};

/** Turn a stored key into a readable field name: "hodApproved" -> "Hod Approved". */
const formatField = (field: string) =>
  field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Browser + OS summary, so the detail panel isn't a wall of user-agent string. */
const summariseAgent = (ua?: string) => {
  if (!ua) return null;
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\//.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' :
    /Firefox\//.test(ua) ? 'Firefox' : 'Unknown browser';
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
};

function StatCard({ icon: Icon, label, value, tone = 'text-gray-900', loading }: any) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gray-50">
          <Icon className="h-5 w-5 text-gray-500" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
          <p className={`text-2xl font-bold mt-0.5 ${tone}`}>
            {loading ? <span className="text-gray-300">—</span> : value}
          </p>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-primary/5 text-primary text-xs font-medium border border-primary/15">
      {label}
      <button type="button" onClick={onRemove} className="hover:bg-primary/10 rounded-full p-0.5">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** Field-level diff, falling back to raw JSON when the server has no `changes`. */
function ChangeTable({ log }: { log: any }) {
  const changes: any[] = log.changes || [];

  if (changes.length > 0) {
    return (
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Field</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Before</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {changes.map((c: any, i: number) => (
              <tr key={`${c.field}-${i}`}>
                <td className="px-4 py-2 font-medium text-gray-700 align-top">{formatField(c.field)}</td>
                <td className="px-4 py-2 text-gray-500 align-top break-words">{formatValue(c.from)}</td>
                <td className="px-4 py-2 text-gray-900 align-top break-words font-medium">{formatValue(c.to)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // A create/delete has only one side; show it as a readable key/value list.
  const snapshot = log.newData || log.previousData;
  if (!snapshot || typeof snapshot !== 'object') return null;
  const entries = Object.entries(snapshot);
  if (entries.length === 0) return null;

  return (
    <dl className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-4 px-4 py-2 text-sm">
          <dt className="w-40 shrink-0 text-gray-500">{formatField(key)}</dt>
          <dd className="text-gray-900 break-words min-w-0">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState<any>(true);
  const [loading, setLoading] = useState<any>(true);
  const [error, setError] = useState<any>('');
  const [searchTerm, setSearchTerm] = useState<any>('');
  const [debouncedSearch, setDebouncedSearch] = useState<any>('');
  const [actionFilter, setActionFilter] = useState<any>('');
  const [entityFilter, setEntityFilter] = useState<any>('');
  const [startDate, setStartDate] = useState<any>('');
  const [endDate, setEndDate] = useState<any>('');
  const [showFilters, setShowFilters] = useState<any>(false);
  const [page, setPage] = useState<any>(1);
  const [pagination, setPagination] = useState(emptyPagination());
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

  const filterParams = useMemo(
    () => ({
      search: debouncedSearch,
      action: actionFilter,
      entity: entityFilter,
      startDate,
      endDate
    }),
    [debouncedSearch, actionFilter, entityFilter, startDate, endDate]
  );

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminAPI.getAuditLogs({
        ...filterParams,
        page,
        limit: DEFAULT_PAGE_SIZE
      });
      if (response.data.success) {
        setLogs(response.data.data || []);
        setPagination(parsePagination(response.data.pagination));
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
  }, [filterParams, page]);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await adminAPI.getAuditLogStats(filterParams);
      if (response.data.success) setStats(response.data.data);
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [filterParams]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('');
    setEntityFilter('');
    setStartDate('');
    setEndDate('');
  };

  const activeFilters = [
    searchTerm && { label: `Search: ${searchTerm}`, clear: () => setSearchTerm('') },
    actionFilter && { label: `Action: ${formatLabel(actionFilter)}`, clear: () => setActionFilter('') },
    entityFilter && { label: `Entity: ${formatEntity(entityFilter)}`, clear: () => setEntityFilter('') },
    startDate && { label: `From: ${startDate}`, clear: () => setStartDate('') },
    endDate && { label: `To: ${endDate}`, clear: () => setEndDate('') }
  ].filter(Boolean) as { label: string; clear: () => void }[];

  // Group the page's entries by calendar day so the list reads as a timeline.
  const grouped = useMemo(() => {
    const map: { day: string; items: any[] }[] = [];
    logs.forEach((log) => {
      const label = dayLabel(log.createdAt);
      const last = map[map.length - 1];
      if (last && last.day === label) last.items.push(log);
      else map.push({ day: label, items: [log] });
    });
    return map;
  }, [logs]);

  const exportCsv = async () => {
    try {
      setExporting(true);
      // Export everything matching the current filters, not just the visible page.
      const total = pagination.total || DEFAULT_PAGE_SIZE;
      const pageSize = 1000;
      const pageCount = Math.min(Math.ceil(total / pageSize), 20); // cap at 20k rows
      const rows: any[] = [];

      for (let p = 1; p <= pageCount; p++) {
        const response = await adminAPI.getAuditLogs({ ...filterParams, page: p, limit: pageSize });
        const batch: any[] = response.data?.data || [];
        rows.push(...batch);
        if (batch.length < pageSize) break;
      }

      const header = [
        'Timestamp', 'Action', 'Entity', 'Reference', 'Description', 'Status',
        'Changed Fields', 'User', 'Email', 'Role', 'IP Address', 'Method', 'Path', 'User Agent'
      ];
      const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        header.join(','),
        ...rows.map((log) =>
          [
            new Date(log.createdAt).toISOString(),
            log.action,
            log.entity,
            log.entityLabel || '',
            log.description,
            log.status || '',
            (log.changes || [])
              .map((c: any) => `${c.field}: ${formatValue(c.from)} -> ${formatValue(c.to)}`)
              .join('; '),
            `${log.user?.firstName || ''} ${log.user?.lastName || ''}`.trim(),
            log.user?.email || log.userEmail || '',
            log.user?.role || log.userRole || '',
            log.ipAddress || '',
            log.method || '',
            log.path || '',
            log.userAgent || ''
          ]
            .map(escape)
            .join(',')
        )
      ].join('\n');

      // Prepend a BOM so Excel reads the UTF-8 correctly.
      const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
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

  const openLog = (log: any) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Audit Logs"
        subtitle="Every action recorded across the system, with who did it and what changed"
        actions={
          <>
            <button
              type="button"
              onClick={() => { fetchLogs(); fetchStats(); }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={exporting || logs.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CSV
            </button>
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Activity} label="Total events" value={(stats?.total ?? 0).toLocaleString()} loading={statsLoading} />
        <StatCard icon={Clock} label="Last 24 hours" value={(stats?.last24h ?? 0).toLocaleString()} loading={statsLoading} />
        <StatCard icon={Users} label="Users active" value={(stats?.activeUsers ?? 0).toLocaleString()} loading={statsLoading} />
        <StatCard
          icon={ShieldAlert}
          label="Failed logins"
          value={(stats?.failedLogins ?? 0).toLocaleString()}
          tone={stats?.failedLogins ? 'text-red-600' : 'text-gray-900'}
          loading={statsLoading}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search description, reference, user, IP address…"
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
              <option key={e} value={e}>{formatEntity(e)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowFilters((v: any) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
              showFilters || startDate || endDate
                ? 'border-primary/30 text-primary bg-primary/5'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Dates
          </button>
        </div>

        {(showFilters || startDate || endDate) && (
          <div className="flex flex-col sm:flex-row gap-4 mt-4 items-end">
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
          </div>
        )}

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
            {activeFilters.map((f) => (
              <FilterChip key={f.label} label={f.label} onRemove={f.clear} />
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-700 underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-50 rounded w-1/5" />
                </div>
                <div className="h-6 w-20 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
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
          <div className="text-center py-16">
            <FileCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">No audit logs found</p>
            <p className="text-sm text-gray-500 mt-1">
              {activeFilters.length > 0
                ? 'Try widening or clearing your filters.'
                : 'Activity will appear here as users work in the system.'}
            </p>
            {activeFilters.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 px-4 py-2 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {grouped.map((group) => (
              <div key={group.day}>
                <div className="sticky top-0 z-10 px-6 py-2 bg-gray-50/95 backdrop-blur border-y border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {group.day}
                  </span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {group.items.map((log: any) => {
                    const Icon = actionIcons[log.action] || FileCheck;
                    const tone = toneFor(log.action);
                    const changeCount = log.changes?.length || 0;

                    return (
                      <li key={log._id}>
                        <button
                          type="button"
                          onClick={() => openLog(log)}
                          className="w-full text-left flex items-start gap-4 px-6 py-4 hover:bg-gray-50/80 transition-colors focus:outline-none focus:bg-gray-50"
                        >
                          {/* Actor */}
                          <div className="relative shrink-0">
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                              {initialsOf(log)}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${tone.dot}`}
                            />
                          </div>

                          {/* Event */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{userName(log)}</span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${tone.badge}`}
                              >
                                <Icon className="h-3 w-3" />
                                {formatLabel(log.action)}
                              </span>
                              <span className="text-xs text-gray-500">{formatEntity(log.entity)}</span>
                              {log.entityLabel && (
                                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                  {log.entityLabel}
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{log.description}</p>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-gray-400">
                              {(log.user?.role || log.userRole) && (
                                <span>{formatLabel(log.user?.role || log.userRole)}</span>
                              )}
                              {log.status && (
                                <span className="text-gray-500">Status: {formatLabel(log.status)}</span>
                              )}
                              {changeCount > 0 && (
                                <span className="text-amber-600 font-medium">
                                  {changeCount} field{changeCount > 1 ? 's' : ''} changed
                                </span>
                              )}
                              {log.ipAddress && <span className="font-mono">{log.ipAddress}</span>}
                            </div>
                          </div>

                          {/* When */}
                          <div className="text-right shrink-0">
                            <div className="text-sm text-gray-700 tabular-nums">{timeOf(log.createdAt)}</div>
                            <div className="text-[11px] text-gray-400">{relativeTime(log.createdAt)}</div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <Pagination
          page={page}
          pages={pagination.pages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="log entries"
        />
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Audit Log Details"
        size="xl"
      >
        {selectedLog && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {/* Headline */}
            <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
              <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                {initialsOf(selectedLog)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{userName(selectedLog)}</span>
                  {(() => {
                    const Icon = actionIcons[selectedLog.action] || FileCheck;
                    const tone = toneFor(selectedLog.action);
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${tone.badge}`}>
                        <Icon className="h-3 w-3" />
                        {formatLabel(selectedLog.action)}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-sm text-gray-600 mt-1">{selectedLog.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(selectedLog.createdAt).toLocaleString('en-ZA')} · {relativeTime(selectedLog.createdAt)}
                </p>
              </div>
            </div>

            {/* Facts */}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <dt className="text-xs text-gray-500">Entity</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">
                  {formatEntity(selectedLog.entity)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Reference</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5 font-mono break-all">
                  {selectedLog.entityLabel || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Resulting status</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">
                  {selectedLog.status ? formatLabel(selectedLog.status) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Email</dt>
                <dd className="text-sm text-gray-900 mt-0.5 break-all">
                  {selectedLog.user?.email || selectedLog.userEmail || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Role</dt>
                <dd className="text-sm text-gray-900 mt-0.5">
                  {formatLabel(selectedLog.user?.role || selectedLog.userRole) || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Record ID</dt>
                <dd className="text-xs text-gray-500 mt-0.5 font-mono break-all">
                  {selectedLog.entityId || '—'}
                </dd>
              </div>
            </dl>

            {/* What changed */}
            {(selectedLog.changes?.length || selectedLog.newData || selectedLog.previousData) && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  What changed
                </h4>
                <ChangeTable log={selectedLog} />
              </div>
            )}

            {/* Where it came from */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400" />
                Request origin
              </h4>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-gray-500">IP address</dt>
                  <dd className="text-sm text-gray-900 mt-0.5 font-mono">
                    {selectedLog.ipAddress || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Endpoint</dt>
                  <dd className="text-sm text-gray-900 mt-0.5 font-mono break-all">
                    {selectedLog.method ? `${selectedLog.method} ${selectedLog.path || ''}` : '—'}
                  </dd>
                </div>
                {selectedLog.userAgent && (
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Monitor className="h-3.5 w-3.5" />
                      Device
                    </dt>
                    <dd className="text-sm text-gray-900 mt-0.5">
                      {summariseAgent(selectedLog.userAgent)}
                      <span className="block text-[11px] text-gray-400 mt-1 break-words">
                        {selectedLog.userAgent}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Raw payloads, tucked away for anyone who needs them */}
            {(selectedLog.previousData || selectedLog.newData || selectedLog.metadata) && (
              <details className="group">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                  Raw data
                </summary>
                <div className="mt-3 space-y-3">
                  {selectedLog.previousData && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Previous</p>
                      <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto max-h-48 border border-gray-100">
                        {JSON.stringify(selectedLog.previousData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.newData && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">New</p>
                      <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto max-h-48 border border-gray-100">
                        {JSON.stringify(selectedLog.newData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.metadata && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Metadata</p>
                      <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto max-h-48 border border-gray-100">
                        {JSON.stringify(selectedLog.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
