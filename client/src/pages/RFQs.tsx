import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchRFQs();
  }, [page, search, statusFilter]);

  const fetchRFQs = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getRFQs({ 
        search, 
        status: statusFilter,
        page,
        limit: DEFAULT_PAGE_SIZE
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
        actions={
          <button
            onClick={() => navigate('/app/rfqs/create')}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
          >
            <Plus className="h-5 w-5" />
            Create RFQ
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search RFQs..."
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>
          <FilterSelect
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

      {/* RFQ Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : rfqs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileSearch className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p>No RFQs found. Create your first RFQ to get started.</p>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">RFQ Number</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Title</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Status</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Deadline</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Suppliers</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((rfq: any) => (
                <tr key={rfq._id} className="hover:bg-gray-50">
                  <td className="py-2 px-3 border border-gray-200 font-mono text-sm font-medium">{rfq.rfqNumber}</td>
                  <td className="py-2 px-3 border border-gray-200">{rfq.title}</td>
                  <td className="py-2 px-3 border border-gray-200">
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
                  <td className="py-2 px-3 border border-gray-200 whitespace-nowrap">
                    {rfq.submissionDeadline ? new Date(rfq.submissionDeadline).toLocaleDateString('en-ZA') : '—'}
                  </td>
                  <td className="py-2 px-3 border border-gray-200">
                    {rfq.invitedSuppliers?.length || 0} supplier{rfq.invitedSuppliers?.length !== 1 ? 's' : ''}
                  </td>
                  <td className="py-2 px-3 border border-gray-200">
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/app/rfqs/${rfq._id}`)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
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
          </table>
        </div>
        <Pagination
          page={page}
          pages={pagination.pages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="RFQs"
        />
        </>
      )}
    </div>
  );
}

