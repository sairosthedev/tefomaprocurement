import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Truck } from 'lucide-react';
import { storesAPI } from '../lib/api';
import { useToast } from './Toast';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import Pagination from './Pagination';
import FilterSelect from './FilterSelect';
import TableSkeleton from './TableSkeleton';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import { cn } from '../../lib/utils';

const STAGES = [
  { value: '', label: 'All' },
  { value: 'with_procurement', label: 'With procurement' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'closed', label: 'Closed' }
];

const STATUS: Record<string, { label: string; step: number }> = {
  pending_acceptance: { label: 'Awaiting procurement', step: 1 },
  accepted: { label: 'Accepted by procurement', step: 1 },
  sourcing: { label: 'Out for quotation', step: 2 },
  quoted: { label: 'Quotes received', step: 2 },
  ordered: { label: 'Purchase order raised', step: 3 },
  completed: { label: 'Completed', step: 4 }
};

const ENDED: Record<string, { label: string; tone: string }> = {
  fulfilled: { label: 'Fulfilled from stock', tone: 'text-emerald-700 bg-emerald-50' },
  cancelled: { label: 'Cancelled', tone: 'text-gray-600 bg-gray-100' },
  rejected: { label: 'Rejected', tone: 'text-red-700 bg-red-50' }
};

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const label = (value?: string) => (value || '').replace(/_/g, ' ');

function StatusPill({ status }: { status: string }) {
  const ended = ENDED[status];
  if (ended) {
    return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap', ended.tone)}>{ended.label}</span>;
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-primary/10 text-primary">
      {STATUS[status]?.label || label(status)}
    </span>
  );
}

/**
 * Requisitions stores has already reviewed, and where each one is now. A
 * forwarded requisition leaves the review queue, but its goods still come back
 * through stores — this is how stores follows it to the delivery.
 */
export default function StoresReviewedList() {
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [stage, query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await storesAPI.getReviewedPurchaseRequisitions({
          page,
          limit,
          ...(stage ? { stage } : {}),
          ...(query ? { search: query } : {})
        });
        if (cancelled) return;
        setItems(res.data.data);
        setPagination(parsePagination(res.data.pagination));
      } catch (error: any) {
        if (!cancelled) showToast(error.response?.data?.message || 'Failed to load reviewed requisitions', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, limit, stage, query]);

  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 md:justify-end">
        <div className="relative w-full sm:w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IR number or title..."
            className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <FilterSelect size="sm" label="Stage" options={STAGES} value={stage} onChange={setStage} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">IR No.</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Title</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Department</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Sent</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Est. Value</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Purchase Orders</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton cols={7} />
          ) : items.length === 0 ? (
            <tbody><tr><td colSpan={7} className="text-center text-gray-500 py-12">No requisitions here yet.</td></tr></tbody>
          ) : (
            <tbody>
              {items.map((pr) => {
                const issuedLines = (pr.items || []).filter((l: any) => (l.quantityFulfilledFromStock || 0) > 0).length;
                // Fulfilled from stock never left stores; everything else was sent on.
                const forwarded = pr.status !== 'fulfilled';

                return (
                  <tr key={pr._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                    <td className="py-2.5 px-3 border-b border-gray-100 align-top font-mono text-xs font-medium whitespace-nowrap">{pr.requisitionNumber}</td>
                    <td className="py-2.5 px-3 border-b border-gray-100 align-top">
                      <p className="text-gray-900">{pr.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {pr.items?.length || 0} line(s){issuedLines ? `, ${issuedLines} issued from stock` : ''}
                        {pr.requiredDate ? ` · Required by ${formatDate(pr.requiredDate)}` : ''}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 border-b border-gray-100 align-top">
                      <p className="text-gray-900">{pr.department?.name || '—'}</p>
                      {(pr.site?.name || pr.requestedBy) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[pr.site?.name, pr.requestedBy ? `${pr.requestedBy.firstName} ${pr.requestedBy.lastName}` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-b border-gray-100 align-top whitespace-nowrap">
                      <p className="text-gray-900">{forwarded ? 'Sent' : 'Closed'} {formatDate(pr.storesReviewedAt)}</p>
                      {pr.storesReviewedBy && (
                        <p className="text-xs text-gray-500 mt-0.5">by {pr.storesReviewedBy.firstName} {pr.storesReviewedBy.lastName}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-b border-gray-100 align-top whitespace-nowrap font-medium text-gray-900">
                      {formatCurrency(pr.estimatedTotal || 0, pr.currency || getCurrentSbuCurrency())}
                    </td>
                    <td className="py-2.5 px-3 border-b border-gray-100 align-top">
                      <StatusPill status={pr.status} />
                      {pr.rfqs?.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                          {pr.rfqs.map((rfq: any) => (
                            <p key={rfq._id}>RFQ {rfq.rfqNumber} ({label(rfq.status)})</p>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-b border-gray-100 align-top">
                      {pr.purchaseOrders?.length > 0 ? (
                        <div className="space-y-2">
                          {pr.purchaseOrders.map((po: any) => (
                            <div key={po._id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-medium text-gray-900 break-all">{po.poNumber}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
                                {label(po.status)}
                              </span>
                              <span className="w-full text-xs text-gray-500">
                                {po.supplier?.companyName || '—'} · {po.expectedDeliveryDate ? `Expected ${formatDate(po.expectedDeliveryDate)}` : 'No delivery date yet'}
                              </span>
                              {['issued', 'partially_received'].includes(po.status) && (
                                <Link
                                  to="/app/deliveries"
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors whitespace-nowrap"
                                >
                                  <Truck className="h-3.5 w-3.5" /> Receive in Deliveries
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
        itemLabel="requisitions"
      />}
    </div>
  );
}
