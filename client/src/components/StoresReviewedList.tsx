import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, Truck, Check } from 'lucide-react';
import { storesAPI } from '../lib/api';
import { useToast } from './Toast';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import Pagination from './Pagination';
import FilterSelect from './FilterSelect';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import { cn } from '../../lib/utils';

const STAGES = [
  { value: '', label: 'All' },
  { value: 'with_procurement', label: 'With procurement' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'closed', label: 'Closed' }
];

/** The path a forwarded requisition takes, as stores would describe it. */
const STEPS = ['Stores review', 'Procurement', 'Quotations', 'Ordered', 'Completed'];

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

function Progress({ status }: { status: string }) {
  const ended = ENDED[status];
  if (ended) {
    return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ended.tone)}>{ended.label}</span>;
  }

  const current = STATUS[status]?.step ?? 1;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <span
            className={cn(
              'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium',
              i < current && 'bg-emerald-50 text-emerald-700',
              i === current && 'bg-primary/10 text-primary ring-1 ring-primary/30',
              i > current && 'bg-gray-100 text-gray-400'
            )}
          >
            {i < current && <Check className="h-3 w-3" />}
            {step}
          </span>
          {i < STEPS.length - 1 && <span className="w-2 h-px bg-gray-300" />}
        </div>
      ))}
    </div>
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
          limit: DEFAULT_PAGE_SIZE,
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
  }, [page, stage, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <FilterSelect label="Stage" options={STAGES} value={stage} onChange={setStage} />
        <div className="relative sm:w-72">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IR number or title"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No requisitions here yet.</p>
      ) : (
        <>
          {items.map((pr) => {
            const issuedLines = (pr.items || []).filter((l: any) => (l.quantityFulfilledFromStock || 0) > 0).length;
            // Fulfilled from stock never left stores; everything else was sent on.
            const forwarded = pr.status !== 'fulfilled';

            return (
              <div key={pr._id} className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 break-all">{pr.requisitionNumber}</p>
                      <p className="text-sm text-gray-600">{pr.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {pr.department?.name || '—'}
                        {pr.site?.name ? ` · ${pr.site.name}` : ''}
                        {pr.requestedBy ? ` · ${pr.requestedBy.firstName} ${pr.requestedBy.lastName}` : ''}
                      </p>
                    </div>
                    <div className="text-left md:text-right text-sm shrink-0">
                      <p className="font-medium text-primary">
                        {formatCurrency(pr.estimatedTotal || 0, pr.currency || getCurrentSbuCurrency())}
                      </p>
                      <p className="text-xs text-gray-500">
                        {forwarded ? 'Sent' : 'Closed'} {formatDate(pr.storesReviewedAt)}
                        {pr.storesReviewedBy ? ` by ${pr.storesReviewedBy.firstName} ${pr.storesReviewedBy.lastName}` : ''}
                      </p>
                    </div>
                  </div>

                  <Progress status={pr.status} />

                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>{pr.items?.length || 0} line(s){issuedLines ? `, ${issuedLines} issued from stock` : ''}</span>
                    {pr.requiredDate && <span>Required by {formatDate(pr.requiredDate)}</span>}
                    {STATUS[pr.status] && <span className="text-gray-700 font-medium">{STATUS[pr.status].label}</span>}
                    {pr.rfqs?.map((rfq: any) => (
                      <span key={rfq._id} className="break-all">RFQ {rfq.rfqNumber} ({label(rfq.status)})</span>
                    ))}
                  </div>
                </div>

                {pr.purchaseOrders?.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3 space-y-2">
                    {pr.purchaseOrders.map((po: any) => (
                      <div key={po._id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                        <span className="font-medium text-gray-900 break-all">{po.poNumber}</span>
                        <span className="text-gray-600">{po.supplier?.companyName || '—'}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 w-fit capitalize">
                          {label(po.status)}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {po.expectedDeliveryDate ? `Expected ${formatDate(po.expectedDeliveryDate)}` : 'No delivery date yet'}
                        </span>
                        {['issued', 'partially_received'].includes(po.status) && (
                          <Link
                            to="/app/deliveries"
                            className="sm:ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <Truck className="h-3.5 w-3.5" /> Receive in Deliveries
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            );
          })}
          <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
            <Pagination
              page={page}
              pages={pagination.pages}
              total={pagination.total}
              onPageChange={setPage}
              itemLabel="requisitions"
            />
          </div>
        </>
      )}
    </div>
  );
}
