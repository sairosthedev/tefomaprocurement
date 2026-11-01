import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function MyInvoices() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());
  const [openId, setOpenId] = useState<string | null>(null);

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
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="My Invoices"
        actions={
          <button
            onClick={() => navigate('/app/submit-invoice')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Submit invoice
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : invoices.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No invoices submitted yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Invoice</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">PO</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Amount</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <React.Fragment key={inv._id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setOpenId(openId === inv._id ? null : inv._id)}
                  >
                    <td className="py-2 px-3 border border-gray-200 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {openId === inv._id ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                        {inv.invoiceNumber}
                      </span>
                    </td>
                    <td className="py-2 px-3 border border-gray-200">{inv.purchaseOrder?.poNumber}</td>
                    <td className="py-2 px-3 border border-gray-200">{formatCurrency(inv.totalAmount, inv.currency || getCurrentSbuCurrency())}</td>
                    <td className="py-2 px-3 border border-gray-200 capitalize">{inv.status.replace(/_/g, ' ')}</td>
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
                                ? { label: 'Submit corrected invoice', to: `/app/submit-invoice?po=${inv.purchaseOrder._id}` }
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
    </div>
  );
}
