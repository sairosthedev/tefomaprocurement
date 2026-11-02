import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supplierAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/constants';
import { getCurrentSbuCurrency } from '../../lib/sbu';
import { useToast } from '../../components/Toast';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination';
import { Loader2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { WorkflowStepper, NextStepCard } from '../../components/WorkflowStepper';
import { supplierInvoiceJourney } from '../../lib/supplierJourney';
import { SubmitInvoiceDrawer } from '../../components/InvoiceForm';

export default function MyInvoices() {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());
  const [openId, setOpenId] = useState<string | null>(null);
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
  }, [page]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await supplierAPI.getMyInvoices({ page, limit: DEFAULT_PAGE_SIZE });
      setInvoices(res.data.data);
      setPagination(parsePagination(res.data.pagination));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="My Invoices"
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

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : invoices.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No invoices submitted yet.</p>
      ) : (
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
            <tbody>
              {invoices.map((inv) => (
                <React.Fragment key={inv._id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setOpenId(openId === inv._id ? null : inv._id)}
                  >
                    <td className="py-2 px-3 border-b border-gray-100 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {openId === inv._id ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                        {inv.invoiceNumber}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">{inv.purchaseOrder?.poNumber}</td>
                    <td className="py-2 px-3 border-b border-gray-100">{formatCurrency(inv.totalAmount, inv.currency || getCurrentSbuCurrency())}</td>
                    <td className="py-2 px-3 border-b border-gray-100 capitalize">{inv.status.replace(/_/g, ' ')}</td>
                  </tr>
                  {openId === inv._id && (
                    <tr>
                      <td colSpan={4} className="px-4 pb-4 bg-gray-50/60">
                        <WorkflowStepper steps={supplierInvoiceJourney(inv).steps} compact />
                        {inv.status === 'rejected' ? (
                          <NextStepCard
                            title="Submit a corrected invoice"
                            description={inv.rejectionReason ? `Finance rejected it: ${inv.rejectionReason}` : 'Finance rejected this invoice.'}
                            action={
                              inv.purchaseOrder?._id
                                ? { label: 'Submit corrected invoice', onClick: () => openSubmit(inv.purchaseOrder._id) }
                                : undefined
                            }
                          />
                        ) : ['submitted', 'variance', 'approved', 'partially_paid'].includes(inv.status) ? (
                          <NextStepCard
                            waiting
                            title={
                              inv.status === 'variance'
                                ? 'Finance to resolve a difference against the order or goods received'
                                : inv.status === 'submitted'
                                  ? 'Finance to match and approve the invoice'
                                  : 'Finance to complete payment'
                            }
                          />
                        ) : null}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
            itemLabel="invoices"
          />
        </div>
      )}

      <SubmitInvoiceDrawer
        isOpen={submitOpen}
        purchaseOrderId={searchParams.get('po')}
        onClose={closeSubmit}
        onSaved={handleSubmitted}
      />
    </div>
  );
}
