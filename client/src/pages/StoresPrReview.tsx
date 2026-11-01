import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storesAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { Loader2, ArrowRight, Search, Zap, PackageCheck } from 'lucide-react';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import Tabs from '../components/Tabs';
import StoresReviewedList from '../components/StoresReviewedList';
import { WorkflowStepper, NextStepCard } from '../components/WorkflowStepper';
import { requisitionJourney } from '../lib/procurementJourney';

const actionLabel: Record<string, string> = {
  store_issue: 'Likely in stock',
  stock_transfer: 'Transfer needed',
  purchase: 'Not in stock'
};

const actionColor: Record<string, string> = {
  store_issue: 'text-emerald-600 bg-emerald-50',
  stock_transfer: 'text-amber-600 bg-amber-50',
  purchase: 'text-red-600 bg-red-50'
};

export default function StoresPrReview() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());
  // "review" is the queue; "sent" is everything stores has already handled,
  // so a forwarded requisition can still be followed to its delivery.
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

  const searchInventory = (pr: any, lineIndex: number, line: any) => {
    const remaining = line.quantity - (line.quantityFulfilledFromStock || 0);
    const params = new URLSearchParams({
      search: line.description,
      prId: pr._id,
      lineIndex: String(lineIndex),
      prNumber: pr.requisitionNumber,
      lineQty: String(remaining),
      lineUnit: line.unit || 'each'
    });
    navigate(`/app/inventory?${params.toString()}`);
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

  const allLinesFullyIssued = (pr: any) =>
    pr.items?.length > 0 &&
    pr.items.every((line: any) => (line.quantityFulfilledFromStock || 0) >= line.quantity);

  /** What stores should do with this requisition now, from its lines. */
  const storesNextStep = (pr: any) => {
    if (allLinesFullyIssued(pr)) {
      return {
        title: 'Every line is issued — close it as fulfilled from stock',
        action: {
          label: acting === `fulfill-${pr._id}` ? 'Fulfilling...' : 'Fulfill from stock',
          onClick: () => fulfillFromStock(pr._id),
          disabled: !!acting
        }
      };
    }
    const anyInStock = pr.items?.some(
      (line: any) =>
        (line.quantityFulfilledFromStock || 0) < line.quantity &&
        line.storeAvailability?.suggestedAction &&
        line.storeAvailability.suggestedAction !== 'purchase'
    );
    if (anyInStock) {
      return {
        title: 'Issue what is in stock',
        description: 'Search inventory for each line and issue from the stock row, or auto-process the lot. Forward anything left over to procurement.',
        action: {
          label: acting === `auto-${pr._id}` ? 'Processing...' : 'Auto-process stock',
          onClick: () => autoProcess(pr._id),
          disabled: !!acting
        }
      };
    }
    return {
      title: 'Nothing is in stock — forward it to procurement',
      description: 'Procurement then sources it through an RFQ.',
      action: {
        label: acting === pr._id ? 'Forwarding...' : 'Forward to procurement',
        onClick: () => forward(pr._id),
        disabled: !!acting
      }
    };
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
        <div className="space-y-6">
          {items.map((pr) => (
            <div key={pr._id} className="border border-gray-200 overflow-x-auto">
              <div className="px-5 pt-4">
                <WorkflowStepper
                  compact
                  steps={
                    requisitionJourney(pr, {
                      isOwner: false,
                      isDepartment: false,
                      isProcurement: false,
                      isProcurementHead: false,
                      isStores: true
                    }).steps
                  }
                />
                <NextStepCard {...storesNextStep(pr)} />
              </div>
              <div className="bg-gray-50 border-b border-gray-200 px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">IR No.</p>
                  <p className="font-semibold">{pr.requisitionNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Date</p>
                  <p>{new Date(pr.createdAt).toLocaleDateString('en-ZA')}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Work Order</p>
                  <p>{pr.workOrder || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Requested By</p>
                  <p>{pr.requestedBy?.firstName} {pr.requestedBy?.lastName}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Dept</p>
                  <p>{pr.department?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Approved By</p>
                  <p>{pr.hodApprovedBy ? `${pr.hodApprovedBy.firstName} ${pr.hodApprovedBy.lastName}` : '—'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Title</p>
                  <p>{pr.title}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Package</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Details</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Units</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Qty Req.</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Qty Issued</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">In Stock</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Hint</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pr.items?.map((line: any, i: number) => {
                      const avail = line.storeAvailability;
                      const action = avail?.suggestedAction;
                      const issued = line.quantityFulfilledFromStock || 0;
                      const remaining = line.quantity - issued;
                      const isFullyIssued = remaining <= 0;

                      return (
                        <tr key={i} className={isFullyIssued ? 'bg-emerald-50/40' : undefined}>
                          <td className="py-2 px-3 border border-gray-200 text-gray-600">{line.package || '—'}</td>
                          <td className="py-2 px-3 border border-gray-200 font-medium text-gray-900">{line.description}</td>
                          <td className="py-2 px-3 border border-gray-200 text-gray-600">{line.unit}</td>
                          <td className="py-2 px-3 border border-gray-200 text-right">{line.quantity}</td>
                          <td className="py-2 px-3 border border-gray-200 text-right font-medium text-emerald-700">
                            {issued > 0 ? issued : '—'}
                          </td>
                          <td className="py-2 px-3 border border-gray-200 text-right font-medium">
                            {avail ? avail.quantityAtSite ?? 0 : '—'}
                          </td>
                          <td className="py-2 px-3 border border-gray-200">
                            {action ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColor[action] || 'text-gray-600 bg-gray-100'}`}>
                                {actionLabel[action] || action}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 border border-gray-200 text-right">
                            <button
                              type="button"
                              onClick={() => searchInventory(pr, i, line)}
                              disabled={isFullyIssued}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-primary text-primary rounded-lg hover:bg-primary/5 disabled:opacity-50"
                            >
                              <Search className="h-3.5 w-3.5" />
                              Search inventory
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Estimated value</span>
                  <span className="font-medium text-primary">{formatCurrency(pr.estimatedTotal, pr.currency || getCurrentSbuCurrency())}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    disabled={!!acting}
                    onClick={() => autoProcess(pr._id)}
                    className="flex items-center justify-center gap-1.5 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/5 disabled:opacity-50"
                  >
                    {acting === `auto-${pr._id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Auto-process stock
                  </button>
                  <button
                    disabled={!!acting || !allLinesFullyIssued(pr)}
                    onClick={() => fulfillFromStock(pr._id)}
                    className="flex items-center justify-center gap-1.5 py-2 border border-emerald-600 text-emerald-700 rounded-lg text-sm hover:bg-emerald-50 disabled:opacity-50"
                    title={allLinesFullyIssued(pr) ? 'Mark as fulfilled from stock' : 'Issue all lines first'}
                  >
                    {acting === `fulfill-${pr._id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                    Fulfill from stock
                  </button>
                  <button
                    disabled={acting === pr._id}
                    onClick={() => forward(pr._id)}
                    className="flex items-center justify-center gap-1.5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {acting === pr._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Forward to procurement
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div>
            <Pagination
              page={page}
              pages={pagination.pages}
              total={pagination.total}
              onPageChange={setPage}
              itemLabel="requisitions"
            />
          </div>
        </div>
      )}
    </div>
  );
}
