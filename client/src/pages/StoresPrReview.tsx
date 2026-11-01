import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storesAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import Tabs from '../components/Tabs';
import StoresReviewedList from '../components/StoresReviewedList';

export default function StoresPrReview() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());
  const [tab, setTab] = useState<'review' | 'sent'>('review');

  useEffect(() => {
    if (tab === 'review') load();
  }, [page, tab]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await storesAPI.getPendingPurchaseRequisitions({ page, limit: DEFAULT_PAGE_SIZE });
      setItems(res.data.data);
      setPagination(parsePagination(res.data.pagination));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const allLinesFullyIssued = (pr: any) =>
    pr.items?.length > 0 &&
    pr.items.every((line: any) => (line.quantityFulfilledFromStock || 0) >= line.quantity);

  const storeStage = (pr: any): { label: string; cls: string } => {
    if (allLinesFullyIssued(pr)) {
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

  const forward = async (id: string) => {
    try {
      setActing(id);
      await storesAPI.forwardPurchaseRequisition(id, { notes: 'Forwarded to procurement after stores review' });
      showToast('Forwarded to procurement — follow it under "Sent on"', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Action failed', 'error');
    } finally {
      setActing(null);
    }
  };

  const autoProcess = async (id: string) => {
    try {
      setActing(`auto-${id}`);
      const res = await storesAPI.autoProcessPurchaseRequisition(id);
      showToast(res.data.message || 'Auto-processed against stock', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Auto-process failed', 'error');
    } finally {
      setActing(null);
    }
  };

  const fulfillFromStock = async (id: string) => {
    try {
      setActing(`fulfill-${id}`);
      await storesAPI.fulfillPurchaseRequisition(id, { notes: 'All lines issued from stock' });
      showToast('Requisition fulfilled from stock', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Fulfill failed', 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Internal Requisitions — Stores Review"
        subtitle="Search inventory for each requested item, confirm stock on hand, then issue from the inventory row. Forward anything not available to procurement."
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
      ) : loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No requisitions awaiting stores review.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">IR No.</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Title</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Department</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Requested By</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Lines</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Est. Value</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Stage</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((pr) => {
                  const stage = storeStage(pr);
                  const fullyIssued = allLinesFullyIssued(pr);
                  return (
                    <tr key={pr._id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 border border-gray-200 font-mono text-xs font-medium whitespace-nowrap">{pr.requisitionNumber}</td>
                      <td className="py-2 px-3 border border-gray-200">{pr.title}</td>
                      <td className="py-2 px-3 border border-gray-200">{pr.department?.name || '—'}</td>
                      <td className="py-2 px-3 border border-gray-200 whitespace-nowrap">
                        {pr.requestedBy ? `${pr.requestedBy.firstName} ${pr.requestedBy.lastName}` : '—'}
                      </td>
                      <td className="py-2 px-3 border border-gray-200 whitespace-nowrap">
                        {new Date(pr.createdAt).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="py-2 px-3 border border-gray-200 text-center">{pr.items?.length || 0}</td>
                      <td className="py-2 px-3 border border-gray-200 whitespace-nowrap">
                        {formatCurrency(pr.estimatedTotal, pr.currency || getCurrentSbuCurrency())}
                      </td>
                      <td className="py-2 px-3 border border-gray-200 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${stage.cls}`}>{stage.label}</span>
                      </td>
                      <td className="py-2 px-3 border border-gray-200">
                        {/* One solid button for the step this row is on: close it out once
                            every line is issued, otherwise send it on to procurement. */}
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {fullyIssued ? (
                            <button
                              disabled={!!acting}
                              onClick={() => fulfillFromStock(pr._id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {acting === `fulfill-${pr._id}` && <Loader2 className="h-3 w-3 animate-spin" />}
                              Fulfill from stock
                            </button>
                          ) : (
                            <>
                              <button
                                disabled={!!acting}
                                onClick={() => forward(pr._id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
                              >
                                {acting === pr._id && <Loader2 className="h-3 w-3 animate-spin" />}
                                Forward to procurement
                              </button>
                              <button
                                disabled={!!acting}
                                onClick={() => autoProcess(pr._id)}
                                title="Issue whatever is in stock and forward the rest"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                              >
                                {acting === `auto-${pr._id}` && <Loader2 className="h-3 w-3 animate-spin" />}
                                Auto-process
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
            itemLabel="requisitions"
          />
        </>
      )}
    </div>
  );
}
