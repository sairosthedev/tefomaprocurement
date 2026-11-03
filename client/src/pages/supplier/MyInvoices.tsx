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
import { Plus, Receipt } from 'lucide-react';
import { SubmitInvoiceDrawer } from '../../components/InvoiceForm';

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
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton cols={4} />
          ) : invoices.length === 0 ? (
            <tbody>
              <tr><td colSpan={4} className="text-center py-12 text-gray-500">
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

      <SubmitInvoiceDrawer
        isOpen={submitOpen}
        purchaseOrderId={searchParams.get('po')}
        onClose={closeSubmit}
        onSaved={handleSubmitted}
      />
    </div>
  );
}
