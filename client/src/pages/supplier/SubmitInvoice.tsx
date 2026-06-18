import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supplierAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/constants';
import { useToast } from '../../components/Toast';
import PageHeader from '../../components/PageHeader';
import { Loader2, Send } from 'lucide-react';

export default function SubmitInvoice() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const po = orders.find((o) => o._id === purchaseOrderId);
    if (po) {
      setItems(
        po.items.map((item: any, index: number) => ({
          description: item.description,
          quantity: item.quantityReceived || item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: (item.quantityReceived || item.quantity) * item.unitPrice,
          poItemIndex: index
        }))
      );
    }
  }, [purchaseOrderId, orders]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await supplierAPI.getMyPurchaseOrders();
      const payable = res.data.data.filter((o: any) =>
        ['issued', 'partially_received', 'completed'].includes(o.status)
      );
      setOrders(payable);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseOrderId || !items.length) {
      showToast('Select a PO and add line items', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await supplierAPI.submitInvoice({
        purchaseOrderId,
        vendorInvoiceNumber,
        invoiceDate,
        items
      });
      showToast('Invoice submitted successfully', 'success');
      navigate('/app/my-invoices');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to submit invoice', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        backTo="/app/my-invoices"
        backLabel="Back"
        title="Submit invoice"
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Purchase order</label>
            <select
              required
              value={purchaseOrderId}
              onChange={(e) => setPurchaseOrderId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select PO...</option>
              {orders.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.poNumber} — {formatCurrency(o.totalAmount)} ({o.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Your invoice number</label>
            <input
              type="text"
              value={vendorInvoiceNumber}
              onChange={(e) => setVendorInvoiceNumber(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Vendor invoice #"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Invoice date</label>
            <input
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {items.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Line items (from received quantities)</label>
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Description</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{item.description}</td>
                      <td className="text-right p-2">{item.quantity}</td>
                      <td className="text-right p-2">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm text-gray-500 mt-2">
                Total: {formatCurrency(items.reduce((s, i) => s + i.totalPrice, 0))}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Submit for three-way match
          </button>
        </form>
      )}
    </div>
  );
}
