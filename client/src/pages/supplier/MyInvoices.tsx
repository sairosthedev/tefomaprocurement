import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supplierAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/constants';
import { getCurrentSbuCurrency } from '../../lib/sbu';
import { useToast } from '../../components/Toast';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import TableSkeleton from '../../components/TableSkeleton';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination';
import { Plus, Receipt, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { SubmitInvoiceDrawer } from '../../components/InvoiceForm';
import ViewButton from '../../components/ViewButton';
import Modal from '../../components/Modal';
import FactsCard from '../../components/supplier/FactsCard';

const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-ZA') : '—');

const thClass =
  'text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap';

// Matches the staff Invoices list.
const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  variance: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  paid: 'bg-emerald-100 text-emerald-700',
  partially_paid: 'bg-cyan-100 text-cyan-700'
};

export default function MyInvoices() {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  // The invoice open in the details modal; null while it is closed.
  const [viewing, setViewing] = useState<any>(null);
  // The submit drawer lives in the URL (?new=1, with ?po= for the order being
  // billed), so links from elsewhere can open it and Back closes it.
  const [searchParams, setSearchParams] = useSearchParams();
  const submitOpen = searchParams.get('new') === '1';

  const openSubmit = (purchaseOrderId?: string) => {
    setSearchParams((params) => {
      params.set('new', '1');
      if (purchaseOrderId) params.set('po', purchaseOrderId);
      else params.delete('po');
      return params;
    });
  };

  const closeSubmit = () => {
    setSearchParams(
      (params) => {
        params.delete('new');
        params.delete('po');
        return params;
      },
      { replace: true }
    );
  };

  const handleSubmitted = () => {
    closeSubmit();
    // Newest first, so the new invoice is on page one.
    if (page !== 1) setPage(1);
    else fetchInvoices();
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, limit]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await supplierAPI.getMyInvoices({ page, limit });
      setInvoices(res.data.data);
      setPagination(parsePagination(res.data.pagination));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="My Invoices"
        subtitle="Submit and track your invoices"
        bottomSpacing="mb-4"
      />

      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => openSubmit()}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Submit invoice
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Invoice</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">PO</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Amount</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton cols={5} />
          ) : invoices.length === 0 ? (
            <tbody>
              <tr><td colSpan={5} className="text-center py-12 text-gray-500">
                <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p>No invoices submitted yet.</p>
              </td></tr>
            </tbody>
          ) : (
            <tbody>
              {invoices.map((inv) => (
                  <tr key={inv._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                    <td className="py-2 px-3 border-b border-gray-100 font-medium">{inv.invoiceNumber}</td>
                    <td className="py-2 px-3 border-b border-gray-100">{inv.purchaseOrder?.poNumber}</td>
                    <td className="py-2 px-3 border-b border-gray-100">{formatCurrency(inv.totalAmount, inv.currency || getCurrentSbuCurrency())}</td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[inv.status] || 'bg-gray-100 text-gray-700'}`}>
                        {inv.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <ViewButton onClick={() => setViewing(inv)} />
                    </td>
                  </tr>
              ))}
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
        itemLabel="invoices"
      />}

      <InvoiceDetailsModal invoice={viewing} onClose={() => setViewing(null)} />

      <SubmitInvoiceDrawer
        isOpen={submitOpen}
        purchaseOrderId={searchParams.get('po')}
        onClose={closeSubmit}
        onSaved={handleSubmitted}
      />
    </div>
  );
}

/**
 * One invoice in full: what was billed, how it fared in the three-way match,
 * and where payment stands. Laid out like the purchase order details modal.
 */
function InvoiceDetailsModal({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const currency = invoice?.currency || getCurrentSbuCurrency();
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);
  const match = invoice?.matchResult;
  const payments: any[] = invoice?.payments || [];
  const paid = ['paid', 'partially_paid'].includes(invoice?.status);

  return (
    <Modal isOpen={Boolean(invoice)} onClose={onClose} title="Invoice Details" size="xl">
      {invoice && (
        <div className="space-y-5">
          {invoice.status === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-800">Invoice rejected{invoice.rejectedAt ? ` on ${day(invoice.rejectedAt)}` : ''}</p>
                {invoice.rejectionReason && <p className="text-red-700 mt-1">{invoice.rejectionReason}</p>}
                <p className="text-red-600 mt-1">Submit a corrected invoice from the purchase order.</p>
              </div>
            </div>
          )}

          <FactsCard
            facts={[
              { label: 'Invoice', value: <span className="font-mono text-primary">{invoice.invoiceNumber}</span> },
              { label: 'Your invoice number', value: invoice.vendorInvoiceNumber || '—' },
              { label: 'Purchase order', value: invoice.purchaseOrder?.poNumber || '—' },
              {
                label: 'Status',
                value: (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[invoice.status] || 'bg-gray-100 text-gray-700'}`}>
                    {invoice.status?.replace(/_/g, ' ')}
                  </span>
                )
              },
              { label: 'Invoice date', value: day(invoice.invoiceDate) },
              { label: 'Due date', value: day(invoice.dueDate) },
              { label: 'Total', value: money(invoice.totalAmount) },
              { label: 'Amount paid', value: money(invoice.amountPaid), sub: paid ? undefined : 'Not yet paid' },
              ...(Number(invoice.balanceDue) > 0 && invoice.status !== 'rejected'
                ? [{ label: 'Balance due', value: money(invoice.balanceDue) }]
                : [])
            ]}
          />

          {match && (
            <div
              className={`rounded-xl p-4 border ${
                match.matched ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {match.matched ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                )}
                <div className="text-sm min-w-0">
                  <p className={`font-medium ${match.matched ? 'text-green-800' : 'text-amber-800'}`}>
                    {match.matched
                      ? 'Matched against the purchase order and the goods received'
                      : 'Differences found against the purchase order or the goods received'}
                  </p>
                  {match.grvNumbers?.length > 0 && (
                    <p className="text-gray-600 mt-1">Goods received notes: {match.grvNumbers.join(', ')}</p>
                  )}
                  {match.messages?.length > 0 && (
                    <ul className={`mt-2 list-disc list-inside space-y-0.5 ${match.matched ? 'text-green-700' : 'text-amber-700'}`}>
                      {match.messages.map((m: string, i: number) => <li key={i}>{m}</li>)}
                    </ul>
                  )}
                  {!match.matched && invoice.status === 'variance' && (
                    <p className="text-amber-700 mt-2">Finance will review the differences before deciding on this invoice.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Invoice lines</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thClass}>Item</th>
                    <th className={thClass}>Qty</th>
                    <th className={thClass}>Unit Price</th>
                    <th className={thClass}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items || []).map((item: any, index: number) => (
                    <tr key={index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                      <td className="py-2 px-3 border-b border-gray-100 font-medium">{item.description}</td>
                      <td className="py-2 px-3 border-b border-gray-100">{item.quantity}</td>
                      <td className="py-2 px-3 border-b border-gray-100">{money(item.unitPrice)}</td>
                      <td className="py-2 px-3 border-b border-gray-100 font-medium">{money(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-right text-gray-500">Subtotal</td>
                    <td className="py-2 px-3">{money(invoice.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-right text-gray-500">VAT</td>
                    <td className="py-2 px-3">{money(invoice.vatAmount)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td colSpan={3} className="py-2 px-3 text-right">Total</td>
                    <td className="py-2 px-3">{money(invoice.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {payments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Payments</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thClass}>Payment</th>
                      <th className={thClass}>Date</th>
                      <th className={thClass}>Method</th>
                      <th className={thClass}>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: any) => (
                      <tr key={p.paymentNumber} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                        <td className="py-2 px-3 border-b border-gray-100 font-mono">{p.paymentNumber}</td>
                        <td className="py-2 px-3 border-b border-gray-100">{day(p.paymentDate)}</td>
                        <td className="py-2 px-3 border-b border-gray-100 capitalize">{String(p.paymentMethod || '').replace(/_/g, ' ') || '—'}</td>
                        <td className="py-2 px-3 border-b border-gray-100">{p.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
