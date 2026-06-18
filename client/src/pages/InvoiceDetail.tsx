import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { financeAPI } from '../lib/api';
import { formatCurrency } from '../lib/constants';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await financeAPI.getInvoice(id);
      setInvoice(res.data.data.invoice);
      setMatch(res.data.data.freshMatch || res.data.data.invoice.matchResult);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load invoice', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (force = false) => {
    try {
      setActing(true);
      await financeAPI.approveInvoice(id, { forceApprove: force });
      showToast('Invoice approved for payment', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Approval failed', 'error');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast('Rejection reason is required', 'error');
      return;
    }
    try {
      setActing(true);
      await financeAPI.rejectInvoice(id, { reason: rejectReason });
      showToast('Invoice rejected', 'success');
      navigate('/app/invoices');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Rejection failed', 'error');
    } finally {
      setActing(false);
    }
  };

  const handlePay = async () => {
    try {
      setActing(true);
      await financeAPI.createPayment({
        invoiceIds: [id],
        paymentDate: new Date().toISOString(),
        paymentMethod: 'bank_transfer',
        complete: true
      });
      showToast('Payment recorded', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Payment failed', 'error');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) return null;

  const canApprove = ['submitted', 'variance'].includes(invoice.status);
  const canPay = invoice.status === 'approved';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        backTo="/app/invoices"
        backLabel="Back to invoices"
        title={invoice.invoiceNumber}
        subtitle={`PO: ${invoice.purchaseOrder?.poNumber} · ${invoice.supplier?.companyName}`}
        actions={
          <span className="text-2xl font-bold text-primary">{formatCurrency(invoice.totalAmount)}</span>
        }
      />

      {match && (
        <div className={`rounded-xl p-6 mb-6 ${match.matched ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            {match.matched ? <CheckCircle className="text-green-600" /> : <AlertTriangle className="text-amber-600" />}
            Three-way match
          </h2>
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div><span className="text-gray-500">PO total</span><p className="font-medium">{formatCurrency(match.poTotal)}</p></div>
            <div><span className="text-gray-500">Received value</span><p className="font-medium">{formatCurrency(match.receivedValue)}</p></div>
            <div><span className="text-gray-500">Invoiced</span><p className="font-medium">{formatCurrency(match.invoicedTotal)}</p></div>
          </div>
          {match.messages?.length > 0 && (
            <ul className="text-sm text-amber-800 list-disc pl-5 space-y-1">
              {match.messages.map((m: string, i: number) => <li key={i}>{m}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold mb-3">Line items</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="text-left py-2">Description</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Unit</th><th className="text-right py-2">Total</th></tr></thead>
          <tbody>
            {invoice.items.map((item: any, i: number) => (
              <tr key={i} className="border-b">
                <td className="py-2">{item.description}</td>
                <td className="text-right py-2">{item.quantity}</td>
                <td className="text-right py-2">{formatCurrency(item.unitPrice)}</td>
                <td className="text-right py-2">{formatCurrency(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(canApprove || canPay) && (
        <div className="bg-white rounded-xl shadow p-6 flex flex-wrap gap-3">
          {canApprove && (
            <>
              <button disabled={acting} onClick={() => handleApprove(false)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                Approve (match required)
              </button>
              <button disabled={acting} onClick={() => handleApprove(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
                Force approve
              </button>
            </>
          )}
          {canPay && (
            <button disabled={acting} onClick={handlePay} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              Record payment
            </button>
          )}
          {canApprove && (
            <div className="w-full flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <button disabled={acting} onClick={handleReject} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
