import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { financeAPI } from '../lib/api';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { WorkflowStepper, NextStepCard, type WorkflowStep } from '../components/WorkflowStepper';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

/**
 * The invoice's path to payment: the order and its goods receipt come first,
 * then the supplier's invoice, the three-way match, Finance approval and payment.
 */
function invoiceSteps(invoice: any, match: any): WorkflowStep[] {
  const status = invoice.status;
  const stopped = status === 'rejected' || status === 'cancelled';
  const approved = ['approved', 'partially_paid', 'paid'].includes(status);
  const received = Boolean(match) && match.hasGrv !== false && (match.receivedValue ?? 0) > 0;
  const matched = approved || Boolean(match?.matched) || Boolean(invoice.varianceOverride);
  const po = invoice.purchaseOrder;

  const raw: Array<{ key: string; label: string; done: boolean; detail?: string; to?: string }> = [
    {
      key: 'po',
      label: 'Purchase order',
      done: true,
      detail: po?.poNumber,
      to: po?._id ? `/app/purchase-orders/${po._id}` : undefined
    },
    {
      key: 'grv',
      label: 'Goods received',
      done: received || approved,
      detail: match?.grvNumbers?.length ? match.grvNumbers.join(', ') : undefined
    },
    { key: 'submitted', label: 'Invoice submitted', done: status !== 'draft', detail: invoice.invoiceNumber },
    {
      key: 'match',
      label: 'Three-way match',
      done: matched,
      detail: invoice.varianceOverride ? 'Variance approved' : status === 'variance' ? 'Variance' : undefined
    },
    { key: 'approval', label: 'Finance approval', done: approved },
    {
      key: 'paid',
      label: 'Paid',
      done: status === 'paid',
      detail: status === 'partially_paid' ? 'Partly paid' : undefined,
      to: status === 'paid' || status === 'partially_paid' ? '/app/payments' : undefined
    }
  ];

  // A rejection stops the invoice at the approval step, whatever the match said.
  const current = stopped ? raw.findIndex((s) => s.key === 'approval') : raw.findIndex((s) => !s.done);
  return raw.map((s, i) => ({
    key: s.key,
    label: s.label,
    detail: i === current && stopped ? (status === 'rejected' ? 'Rejected' : 'Cancelled') : s.detail,
    to: s.to,
    state: i === current ? (stopped ? 'stopped' : 'current') : s.done ? 'done' : 'upcoming'
  }));
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
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

  // `force` carries the written reason for overriding a variance; the API
  // rejects an override without one.
  const handleApprove = async (force?: string) => {
    if (force !== undefined && !force.trim()) {
      showToast('A reason is required to approve against a variance', 'error');
      return;
    }
    try {
      setActing(true);
      await financeAPI.approveInvoice(id, force ? { forceApprove: force } : {});
      showToast('Invoice approved for payment', 'success');
      setOverrideReason('');
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

  const currency = invoice.currency || invoice.purchaseOrder?.currency || getCurrentSbuCurrency();
  const canApprove = ['submitted', 'variance'].includes(invoice.status);
  const canPay = invoice.status === 'approved';
  // Nothing receipted and accepted means the approval gate will refuse
  // regardless of any override.
  const awaitingGrv =
    Boolean(match) && (match.hasGrv === false || (match.receivedValue ?? 0) <= 0);

  return (
    <div className="p-6">
      <PageHeader
        backTo="/app/invoices"
        backLabel="Back to invoices"
        title={invoice.invoiceNumber}
        subtitle={`PO: ${invoice.purchaseOrder?.poNumber} · ${invoice.supplier?.companyName}`}
        actions={
          <span className="text-2xl font-bold text-primary">{formatCurrency(invoice.totalAmount, currency)}</span>
        }
      />

      <WorkflowStepper steps={invoiceSteps(invoice, match)} />
      {canApprove && awaitingGrv ? (
        <NextStepCard
          waiting
          title="Stores to receive the goods"
          description="An invoice is payable only once the goods are receipted on a GRV. It can still be rejected below."
        />
      ) : canApprove ? (
        <NextStepCard
          title={match && !match.matched ? 'Resolve the variance' : 'Approve the invoice for payment'}
          description={
            match && !match.matched
              ? 'The invoice does not match the order and goods received. Reject it, or approve with a written reason below.'
              : 'The invoice matches the order and the goods received.'
          }
          action={match && !match.matched ? undefined : { label: 'Approve', onClick: () => handleApprove(), disabled: acting }}
        />
      ) : canPay ? (
        <NextStepCard
          title="Record the payment"
          description="Approved for payment. Payments are run on Tuesdays and Thursdays."
          action={{ label: 'Record payment', onClick: handlePay, disabled: acting }}
        />
      ) : invoice.status === 'partially_paid' ? (
        <NextStepCard
          title="Pay the balance"
          description={`Balance due: ${formatCurrency(invoice.balanceDue ?? 0, currency)}`}
          action={{ label: 'Open payments', to: '/app/payments' }}
        />
      ) : null}

      {invoice.status === 'rejected' && invoice.rejectionReason && (
        <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Rejected:</strong> {invoice.rejectionReason}
        </div>
      )}

      {match && (
        <div className={`rounded-xl p-6 mb-6 ${match.matched ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            {match.matched ? <CheckCircle className="text-green-600" /> : <AlertTriangle className="text-amber-600" />}
            Three-way match
          </h2>
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div><span className="text-gray-500">PO total</span><p className="font-medium">{formatCurrency(match.poTotal, currency)}</p></div>
            <div><span className="text-gray-500">Received value</span><p className="font-medium">{formatCurrency(match.receivedValue, currency)}</p></div>
            <div><span className="text-gray-500">Invoiced</span><p className="font-medium">{formatCurrency(match.invoicedTotal, currency)}</p></div>
          </div>
          <div className="text-sm mb-4">
            <span className="text-gray-500">Goods received notes</span>
            {match.grvNumbers?.length > 0 ? (
              <p className="font-medium">{match.grvNumbers.join(', ')}</p>
            ) : (
              <p className="font-medium text-red-700">
                None — stores has not receipted these goods
              </p>
            )}
          </div>
          {match.messages?.length > 0 && (
            <ul className="text-sm text-amber-800 list-disc pl-5 space-y-1">
              {match.messages.map((m: string, i: number) => <li key={i}>{m}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="mb-6">
        <h2 className="font-semibold mb-3">Line items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Description</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Qty</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Unit</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item: any, i: number) => (
                <tr key={i} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                  <td className="py-2 px-3 border-b border-gray-100">{item.description}</td>
                  <td className="text-right py-2.5 px-4">{item.quantity}</td>
                  <td className="text-right py-2.5 px-4">{formatCurrency(item.unitPrice, currency)}</td>
                  <td className="text-right py-2.5 px-4">{formatCurrency(item.totalPrice, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(canApprove || canPay) && (
        <div className="bg-white rounded-xl shadow p-6 flex flex-wrap gap-3">
          {canApprove && !awaitingGrv && (
            <>
              <button disabled={acting} onClick={() => handleApprove()} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                Approve
              </button>
              {match && !match.matched && (
                <div className="w-full flex gap-2">
                  <input
                    type="text"
                    placeholder="Reason for approving despite the variance..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2"
                  />
                  <button
                    disabled={acting || !overrideReason.trim()}
                    onClick={() => handleApprove(overrideReason)}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    Approve with variance
                  </button>
                </div>
              )}
            </>
          )}
          {canApprove && awaitingGrv && (
            <div className="w-full flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {match?.hasGrv
                  ? 'No goods on this purchase order were accepted into stores, so nothing is payable yet. This invoice can still be rejected.'
                  : 'This invoice cannot be approved until stores receipts the goods and raises a GRV. It can still be rejected.'}
              </span>
            </div>
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
