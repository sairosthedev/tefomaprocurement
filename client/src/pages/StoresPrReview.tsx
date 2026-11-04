import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { storesAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import TableSkeleton from '../components/TableSkeleton';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import Tabs from '../components/Tabs';
import StoresReviewedList from '../components/StoresReviewedList';
import StoresReviewDrawer, { allLinesIssued, linesNeedingCategory } from '../components/StoresReviewDrawer';

export default function StoresPrReview() {
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<'forward' | 'auto' | 'fulfill' | null>(null);
  // The IR open for review lives in the URL (?review=), so issuing a line from
  // the inventory page can bring stores straight back to it.
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewingId = searchParams.get('review');
  const reviewing = items.find((pr) => pr._id === reviewingId) || null;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  const [tab, setTab] = useState<'review' | 'sent'>('review');

  useEffect(() => {
    if (tab === 'review') load();
  }, [page, limit, tab]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await storesAPI.getPendingPurchaseRequisitions({ page, limit });
      setItems(res.data.data);
      setPagination(parsePagination(res.data.pagination));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openReview = (id: string) =>
    setSearchParams((params) => {
      params.set('review', id);
      return params;
    });

  const closeReview = () =>
    setSearchParams(
      (params) => {
        params.delete('review');
        return params;
      },
      { replace: true }
    );

  const storeStage = (pr: any): { label: string; cls: string } => {
    if (allLinesIssued(pr)) {
      return { label: 'All issued', cls: 'bg-emerald-100 text-emerald-700' };
    }
    const anyInStock = pr.items?.some(
      (line: any) =>
        (line.quantityFulfilledFromStock || 0) < line.quantity &&
        line.storeAvailability?.suggestedAction &&
        line.storeAvailability.suggestedAction !== 'purchase'
    );
    if (anyInStock) return { label: 'Partial in stock', cls: 'bg-amber-100 text-amber-700' };
    return { label: 'Not in stock', cls: 'bg-red-100 text-red-700' };
  };

  const ACTIONS = {
    forward: {
      call: (id: string) => storesAPI.forwardPurchaseRequisition(id, { notes: 'Forwarded to procurement after stores review' }),
      done: (_res: any) => 'Forwarded to procurement — follow it under "Sent on"',
      failed: 'Action failed'
    },
    auto: {
      call: (id: string) => storesAPI.autoProcessPurchaseRequisition(id),
      done: (res: any) => res.data.message || 'Auto-processed against stock',
      failed: 'Auto-process failed'
    },
    fulfill: {
      call: (id: string) => storesAPI.fulfillPurchaseRequisition(id, { notes: 'All lines issued from stock' }),
      done: (_res: any) => 'Requisition fulfilled from stock',
      failed: 'Fulfill failed'
    }
  };

  /** Run a decision on the IR under review; it leaves the queue when it succeeds. */
  const act = async (action: keyof typeof ACTIONS) => {
    if (!reviewing) return;
    const { call, done, failed } = ACTIONS[action];
    try {
      setActing(action);
      const res = await call(reviewing._id);
      showToast(done(res), 'success');
      closeReview();
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || failed, 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Internal Requisitions — Stores Review"
        subtitle="Open each IR to check its lines against stock and issue what you hold. Categorise what is still owed, then forward it to procurement."
      />

      <Tabs
        className="mb-6"
        activeTab={tab}
        onTabChange={setTab}
        tabs={[
          { value: 'review', label: 'To review', count: tab === 'review' && !loading ? pagination.total : undefined },
          { value: 'sent', label: 'Sent on' }
        ]}
      />

      {tab === 'sent' ? (
        <StoresReviewedList />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">IR No.</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Title</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Department</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Requested By</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Lines</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Est. Value</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Stage</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton cols={9} />
              ) : items.length === 0 ? (
                <tbody><tr><td colSpan={9} className="text-center text-gray-500 py-12">No requisitions awaiting stores review.</td></tr></tbody>
              ) : (
              <tbody>
                {items.map((pr) => {
                  const stage = storeStage(pr);
                  const needCategory = linesNeedingCategory(pr).length;
                  return (
                    <tr key={pr._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                      <td className="py-2 px-3 border-b border-gray-100 font-mono text-xs font-medium whitespace-nowrap">{pr.requisitionNumber}</td>
                      <td className="py-2 px-3 border-b border-gray-100">{pr.title}</td>
                      <td className="py-2 px-3 border-b border-gray-100">{pr.department?.name || '—'}</td>
                      <td className="py-2 px-3 border-b border-gray-100 whitespace-nowrap">
                        {pr.requestedBy ? `${pr.requestedBy.firstName} ${pr.requestedBy.lastName}` : '—'}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 whitespace-nowrap">
                        {new Date(pr.createdAt).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-center">{pr.items?.length || 0}</td>
                      <td className="py-2 px-3 border-b border-gray-100 whitespace-nowrap">
                        {formatCurrency(pr.estimatedTotal, pr.currency || getCurrentSbuCurrency())}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${stage.cls}`}>{stage.label}</span>
                        {needCategory > 0 && (
                          <span className="block mt-1 text-xs text-amber-700">{needCategory} to categorise</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
                        {/* Every decision is taken in the review, where the lines are. */}
                        <button
                          onClick={() => openReview(pr._id)}
                          className="px-2 py-1 text-xs font-medium border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors whitespace-nowrap"
                        >
                          Review
                        </button>
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
        </>
      )}

      {reviewing && (
        <StoresReviewDrawer
          requisition={reviewing}
          onClose={closeReview}
          onUpdated={(updated) => setItems((current) => current.map((pr) => (pr._id === updated._id ? updated : pr)))}
          onAction={act}
          acting={acting}
        />
      )}
    </div>
  );
}
