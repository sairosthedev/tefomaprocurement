import React, { useEffect, useState } from 'react';
import { storesAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { Package, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../lib/constants';

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
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
        <Package className="h-7 w-7 text-primary" />
        Purchase Requisitions — Stores Review
      </h1>
      <p className="text-gray-500 mb-6 text-sm">FC-HQ-P-07 §6.3.1–6.3.2: Check stock before procurement.</p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No requisitions awaiting stores review.</p>
      ) : (
        <div className="space-y-4">
          {items.map((pr) => (
            <div key={pr._id} className="bg-white rounded-xl shadow p-5 border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold">{pr.requisitionNumber}</p>
                  <p className="text-gray-600">{pr.title}</p>
                  <p className="text-sm text-gray-400">
                    {pr.requestedBy?.firstName} {pr.requestedBy?.lastName} · {pr.department?.name || '—'}
                  </p>
                </div>
                <span className="font-medium text-primary">{formatCurrency(pr.estimatedTotal)}</span>
              </div>
              <ul className="text-sm text-gray-600 mb-4 list-disc pl-5">
                {pr.items?.slice(0, 3).map((item: any, i: number) => (
                  <li key={i}>{item.quantity} {item.unit} — {item.description}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  disabled={acting === pr._id}
                  onClick={() => fulfill(pr._id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" /> Fulfill from stock
                </button>
                <button
                  disabled={acting === pr._id}
                  onClick={() => forward(pr._id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  <ArrowRight className="h-4 w-4" /> Forward to procurement
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
