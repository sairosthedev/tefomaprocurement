import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import FilterSelect from '../components/FilterSelect';
import PageHeader from '../components/PageHeader';
import {
  Plus,
  FileSearch,
  Loader2,
  Send,
  Clock,
  Search
} from 'lucide-react';
import Pagination from '../components/Pagination';
import TableSkeleton from '../components/TableSkeleton';
import { CreateRFQDrawer } from '../components/RFQForm';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';

function sourcingDeadlineBadge(createdAt: string): { label: string; cls: string } | null {
  const ms = Date.now() - new Date(createdAt).getTime();
  const twoDays = 2 * 24 * 3600000;
  const remaining = twoDays - ms;
  if (remaining < 0) {
    const daysOver = Math.ceil(-remaining / 86400000);
    return { label: `${daysOver}d overdue (§ 2-day sourcing)`, cls: 'bg-red-100 text-red-700' };
  }
  const hrsLeft = Math.ceil(remaining / 3600000);
  if (hrsLeft <= 24) {
    return { label: `${hrsLeft}h left to source`, cls: 'bg-amber-100 text-amber-700' };
  }
  return null;
}

const statusColors: any = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  closed: 'bg-amber-100 text-amber-700',
  evaluating: 'bg-purple-100 text-purple-700',
  awarded: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

export default function RFQs() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rfqs, setRFQs] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [search, setSearch] = useState<any>('');
  const [statusFilter, setStatusFilter] = useState<any>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  // The create drawer lives in the URL (?new=1, with ?requisition= when it is
  // raised from one), so links from elsewhere can open it and Back closes it.
  const [searchParams, setSearchParams] = useSearchParams();
  const createOpen = searchParams.get('new') === '1';
  const createFromRequisition = searchParams.get('requisition');

  const openCreate = () => {
    setSearchParams((params) => {
      params.set('new', '1');
      return params;
    });
  };

  const closeCreate = () => {
    setSearchParams(
      (params) => {
        params.delete('new');
        params.delete('requisition');
        return params;
      },
      { replace: true }
    );
  };

  // Straight to the new RFQ, where its next steps are. Replacing the ?new=1
  // entry means Back from there returns to the list, not to an empty form.
  const handleCreated = (rfqId?: string) => {
    if (rfqId) {
      navigate(`/app/rfqs/${rfqId}`, { replace: true });
      return;
    }
    closeCreate();
    // Newest first, so the new RFQ is on page one.
    if (page !== 1) setPage(1);
    else fetchRFQs();
  };

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchRFQs();
  }, [page, limit, search, statusFilter]);

  const fetchRFQs = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getRFQs({ 
        search, 
        status: statusFilter,
        page,
        limit
      });
      setRFQs(response.data.data);
      setPagination(parsePagination(response.data.pagination));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load RFQs', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="RFQs (Enquiries)"
        subtitle="Manage requests for quotations"
        bottomSpacing="mb-4"
      />

      {/* Filters */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create RFQ
          </button>
          {/* Pushed to the right edge, with or without the button beside it. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:ml-auto">
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search RFQs..."
                value={search}
                onChange={(e: any) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <FilterSelect
              size="sm"
              label="Status"
              options={[
                { value: '', label: 'All' },
                { value: 'draft', label: 'Draft' },
                { value: 'open', label: 'Open' },
                { value: 'closed', label: 'Closed' },
                { value: 'evaluating', label: 'Evaluating' },
                { value: 'awarded', label: 'Awarded' }
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
        </div>
      </div>

      {/* RFQ Cards */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">RFQ Number</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Title</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Deadline</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Suppliers</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton cols={6} />
          ) : rfqs.length === 0 ? (
            <tbody>
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">
                <FileSearch className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p>No RFQs found. Create your first RFQ to get started.</p>
              </td></tr>
            </tbody>
          ) : (
            <tbody>
              {rfqs.map((rfq: any) => (
                <tr key={rfq._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                  <td className="py-2 px-3 border-b border-gray-100 font-mono text-sm font-medium">{rfq.rfqNumber}</td>
                  <td className="py-2 px-3 border-b border-gray-100">{rfq.title}</td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    <div className="flex flex-wrap gap-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[rfq.status]}`}>
                        {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
                      </span>
                      {rfq.status === 'open' && (() => {
                        const badge = sourcingDeadlineBadge(rfq.createdAt);
                        return badge ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>
                            <Clock className="h-3 w-3" />{badge.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100 whitespace-nowrap">
                    {rfq.submissionDeadline ? new Date(rfq.submissionDeadline).toLocaleDateString('en-ZA') : '—'}
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    {rfq.invitedSuppliers?.length || 0} supplier{rfq.invitedSuppliers?.length !== 1 ? 's' : ''}
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/app/rfqs/${rfq._id}`)}
                        className="px-2 py-1 text-xs border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors"
                      >
                        View
                      </button>
                      {rfq.status === 'draft' && (
                        <button className="px-2 py-1 text-xs border border-primary text-primary rounded hover:bg-primary/5 flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          Publish
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      {!loading && <Pagination
        page={page}
        pages={pagination.pages}
        total={pagination.total}
        onPageChange={setPage}
        pageSize={limit}
        onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
        itemLabel="RFQs"
      />}

      <CreateRFQDrawer
        isOpen={createOpen}
        requisitionId={createFromRequisition}
        onClose={closeCreate}
        onSaved={handleCreated}
      />
    </div>
  );
}

