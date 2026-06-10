import React, { useEffect, useState } from 'react';
import { storesAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { Package, Loader2, ArrowRight, CheckCircle, Zap } from 'lucide-react';
import { formatCurrency } from '../lib/constants';

const actionLabel: Record<string, string> = {
  store_issue: 'Issue from stock',
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
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await storesAPI.getPendingPurchaseRequisitions();
      setItems(res.data.data);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const autoProcess = async (id: string) => {
    try {
      setActing(id);
      const res = await storesAPI.autoProcessPurchaseRequisition(id);
      showToast(res.data?.message || 'Requisition processed', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Auto-process failed', 'error');
    } finally {
      setActing(null);
    }
  };

  const fulfill = async (id: string) => {
    try {
      setActing(id);
      await storesAPI.fulfillPurchaseRequisition(id, { notes: 'Stock available — issued from stores' });
      showToast('Requisition fulfilled from stock', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Action failed', 'error');
    } finally {
      setActing(null);
    }
  };

  const forward = async (id: string) => {
    try {
      setActing(id);
      await storesAPI.forwardPurchaseRequisition(id, { notes: 'Insufficient stock — forwarded to procurement' });
      showToast('Forwarded to procurement', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Action failed', 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
        <Package className="h-7 w-7 text-primary" />
        Internal Requisitions — Stores Review
      </h1>
      <p className="text-gray-500 mb-6 text-sm">
        Stock enquiry before procurement. <span className="font-medium text-gray-700">Auto-process</span> issues
        available stock (Qty Delivered) and forwards the balance — like the paper IR form.
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No requisitions awaiting stores review.</p>
      ) : (
        <div className="space-y-6">
          {items.map((pr) => (
            <div key={pr._id} className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              {/* IR header — mirrors paper form */}
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

              {/* IR line table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-white">
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Package</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Details</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Units</th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">Qty Req.</th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">In Stock</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pr.items?.map((line: any, i: number) => {
                      const avail = line.storeAvailability;
                      const action = avail?.suggestedAction;
                      return (
                        <tr key={i}>
                          <td className="py-2.5 px-4 text-gray-600">{line.package || '—'}</td>
                          <td className="py-2.5 px-4 font-medium text-gray-900">{line.description}</td>
                          <td className="py-2.5 px-4 text-gray-600">{line.unit}</td>
                          <td className="py-2.5 px-4 text-right">{line.quantity}</td>
                          <td className="py-2.5 px-4 text-right font-medium">
                            {avail ? avail.quantityAtSite ?? 0 : '—'}
                          </td>
                          <td className="py-2.5 px-4">
                            {action ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColor[action] || 'text-gray-600 bg-gray-100'}`}>
                                {actionLabel[action] || action}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Unknown</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-4 border-t border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-500">Estimated value</span>
                  <span className="font-medium text-primary">{formatCurrency(pr.estimatedTotal)}</span>
                </div>
                <button
                  disabled={acting === pr._id}
                  onClick={() => autoProcess(pr._id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 mb-2"
                >
                  {acting === pr._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Auto-process (issue stock & forward balance)
                </button>
                <div className="flex gap-2">
                  <button
                    disabled={acting === pr._id}
                    onClick={() => fulfill(pr._id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-green-600 text-green-700 rounded-lg text-xs hover:bg-green-50 disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Mark fulfilled
                  </button>
                  <button
                    disabled={acting === pr._id}
                    onClick={() => forward(pr._id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ArrowRight className="h-3.5 w-3.5" /> Forward all
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
