import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import FilterSelect from '../../components/FilterSelect';
import { 
  FileText, CheckCircle, XCircle, Clock, 
  Search, Calendar, DollarSign, Package, AlertCircle,
  Eye, Download, TrendingUp, Award
} from 'lucide-react';
import ViewButton from '../../components/ViewButton';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import FactsCard from '../../components/supplier/FactsCard';
import Pagination from '../../components/Pagination';
import TableSkeleton from '../../components/TableSkeleton';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination';
import { formatCurrency } from '../../lib/constants';
import { getCurrentSbuCurrency } from '../../lib/sbu';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

const statusColors: any = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  awarded: 'bg-purple-100 text-purple-700',
  expired: 'bg-gray-100 text-gray-700'
};

const statusLabels: any = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  awarded: 'Awarded',
  expired: 'Expired'
};

export default function MySubmittedQuotations() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [searchTermInput, setSearchTerm] = useState<any>('');
  // The box shows what's typed; the list is fetched once typing pauses.
  const searchTerm = useDebouncedValue(searchTermInput);
  const [statusFilter, setStatusFilter] = useState<any>('');
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState<any>(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchQuotations();
  }, [page, limit, searchTerm, statusFilter]);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/supplier/quotations', {
        params: { 
          status: statusFilter || undefined,
          search: searchTerm || undefined,
          page,
          limit
        }
      });
      if (response.data.success) {
        setQuotations(response.data.data || []);
        setPagination(parsePagination(response.data.pagination));
      }
    } catch (error: any) {
      console.error('Failed to fetch quotations:', error);
      showToast('Failed to load quotations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const quotationStatusTabs = [
    { value: '', label: 'All', count: quotations.length },
    { value: 'submitted', label: 'Submitted', count: quotations.filter((q: any) => q.status === 'submitted').length },
    { value: 'under_review', label: 'Under Review', count: quotations.filter((q: any) => q.status === 'under_review').length },
    { value: 'accepted', label: 'Accepted', count: quotations.filter((q: any) => q.status === 'accepted' || q.status === 'awarded').length },
    { value: 'rejected', label: 'Rejected', count: quotations.filter((q: any) => q.status === 'rejected').length }
  ];

  return (
    <div className="p-8">
      <PageHeader
        title="My Submitted Quotations"
        subtitle="View and track all your submitted quotations"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Quotations</p>
              <p className="text-2xl font-bold text-blue-700">{quotations.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600 font-medium">Under Review</p>
              <p className="text-2xl font-bold text-amber-700">
                {quotations.filter((q: any) => q.status === 'under_review').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <Award className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600 font-medium">Accepted/Awarded</p>
              <p className="text-2xl font-bold text-green-700">
                {quotations.filter((q: any) => q.status === 'accepted' || q.status === 'awarded').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-600 font-medium">Total Value</p>
              <p className="text-xl font-bold text-purple-700">
                {formatCurrency(
                  quotations.reduce((sum: any, q: any) => sum + (q.totalAmount || 0), 0),
                  quotations[0]?.currency || getCurrentSbuCurrency()
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:justify-end">
          <div className="relative w-full sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search quotations..."
              title="Search by quotation number, RFQ number, or title"
              value={searchTermInput}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <FilterSelect
            label="Status"
            size="sm"
            options={quotationStatusTabs}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>

      {/* Quotations Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Quotation #</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">RFQ Details</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Total Amount</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Delivery Period</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Submitted Date</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton cols={7} />
          ) : quotations.length === 0 ? (
            <tbody>
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">
                <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="font-medium">No quotations found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchTerm || statusFilter ? 'Try adjusting your filters' : 'Submit your first quotation to get started'}
                </p>
              </td></tr>
            </tbody>
          ) : (
            <tbody>
              {quotations.map((quote: any) => (
                <tr key={quote._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                  <td className="py-2 px-3 border-b border-gray-100">
                    <span className="font-mono font-medium text-primary">
                      {quote.quotationNumber || `QT-${quote._id.slice(-6).toUpperCase()}`}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900">{quote.rfq?.title || 'N/A'}</p>
                      <p className="text-xs text-gray-500 font-mono">{quote.rfq?.rfqNumber || 'N/A'}</p>
                      {quote.rfq?.submissionDeadline && (
                        <p className="text-xs text-gray-400 mt-1">
                          Deadline: {new Date(quote.rfq.submissionDeadline).toLocaleDateString('en-ZA')}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    <div>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(quote.totalAmount, quote.currency || getCurrentSbuCurrency())}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{quote.currency || getCurrentSbuCurrency()}</p>
                    </div>
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Package className="h-4 w-4" />
                      <span>{quote.deliveryPeriod || quote.deliveryDays || 'N/A'} days</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(quote.submittedAt || quote.createdAt).toLocaleDateString('en-ZA')}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(quote.submittedAt || quote.createdAt).toLocaleTimeString('en-ZA', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[quote.status] || statusColors.submitted}`}>
                      {statusLabels[quote.status] || quote.status?.replace('_', ' ') || 'Submitted'}
                    </span>
                    {quote.status === 'accepted' || quote.status === 'awarded' ? (
                      <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                        <Award className="h-3 w-3" />
                        <span>Won</span>
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    <ViewButton
                      onClick={() => {
                        setSelectedQuotation(quote);
                        setShowViewModal(true);
                      }}
                    />
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
        itemLabel="quotations"
      />}

      {/* View Details Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Quotation Details"
        size="xl"
      >
        {selectedQuotation && (
          <div className="space-y-5">
            {/* Status Banner */}
            {(selectedQuotation.status === 'accepted' || selectedQuotation.status === 'awarded') && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Award className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-green-800 text-lg">🎉 Quotation Accepted!</h3>
                    <p className="text-sm text-green-700 mt-1">
                      Congratulations! Your quotation has been accepted and you may receive a purchase order soon.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedQuotation.status === 'rejected' && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-red-800 text-lg">Quotation Not Selected</h3>
                    <p className="text-sm text-red-700 mt-1">
                      This quotation was not selected for this RFQ. Keep submitting quotations for other opportunities!
                    </p>
                  </div>
                </div>
              </div>
            )}

            <FactsCard
              facts={[
                {
                  label: 'Quotation number',
                  value: (
                    <span className="font-mono text-primary">
                      {selectedQuotation.quotationNumber || `QT-${selectedQuotation._id.slice(-6).toUpperCase()}`}
                    </span>
                  )
                },
                {
                  label: 'Status',
                  value: (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedQuotation.status] || statusColors.submitted}`}>
                      {statusLabels[selectedQuotation.status] || selectedQuotation.status?.replace('_', ' ') || 'Submitted'}
                    </span>
                  )
                },
                {
                  label: 'RFQ',
                  value: <span className="font-mono">{selectedQuotation.rfq?.rfqNumber || 'N/A'}</span>,
                  sub: selectedQuotation.rfq?.title || 'N/A'
                },
                { label: 'Currency', value: selectedQuotation.currency || getCurrentSbuCurrency() },
                {
                  label: 'Subtotal',
                  value: formatCurrency(selectedQuotation.subtotal || selectedQuotation.totalAmount, selectedQuotation.currency || getCurrentSbuCurrency())
                },
                {
                  label: 'VAT amount',
                  value: formatCurrency(selectedQuotation.vatAmount || 0, selectedQuotation.currency || getCurrentSbuCurrency())
                },
                {
                  label: 'Grand total',
                  value: (
                    <span className="text-primary">
                      {formatCurrency(selectedQuotation.totalAmount, selectedQuotation.currency || getCurrentSbuCurrency())}
                    </span>
                  )
                },
                {
                  label: 'Delivery period',
                  value: `${selectedQuotation.deliveryPeriod || selectedQuotation.deliveryDays || 'N/A'} days`
                },
                { label: 'Payment terms', value: selectedQuotation.paymentTerms || 'N/A' },
                {
                  label: 'Valid until',
                  value: selectedQuotation.validUntil
                    ? new Date(selectedQuotation.validUntil).toLocaleDateString('en-ZA')
                    : selectedQuotation.validityPeriod
                      ? new Date(new Date(selectedQuotation.submittedAt || selectedQuotation.createdAt).getTime() + selectedQuotation.validityPeriod * 86400000).toLocaleDateString('en-ZA')
                      : 'N/A'
                },
                {
                  label: 'Submitted',
                  value: new Date(selectedQuotation.submittedAt || selectedQuotation.createdAt).toLocaleString('en-ZA')
                },
                ...(selectedQuotation.updatedAt && selectedQuotation.updatedAt !== selectedQuotation.createdAt
                  ? [{ label: 'Last updated', value: new Date(selectedQuotation.updatedAt).toLocaleString('en-ZA') }]
                  : [])
              ]}
            />

            {/* Items Table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quoted items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Item Description</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Quantity</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Unit</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Unit Price</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Brand</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuotation.items?.map((item: any, index: any) => (
                      <tr key={index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                        <td className="py-2 px-3 border-b border-gray-100">
                          <p className="font-medium text-gray-900">{item.description}</p>
                          {item.notes && (
                            <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                          )}
                        </td>
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-600">{item.quantity}</td>
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-600">{item.unit}</td>
                        <td className="py-2 px-3 border-b border-gray-100 font-medium text-gray-900">
                          {formatCurrency(item.unitPrice, selectedQuotation.currency || getCurrentSbuCurrency())}
                        </td>
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-600">{item.brand || '-'}</td>
                        <td className="py-2 px-3 border-b border-gray-100 font-semibold text-gray-900 text-right">
                          {formatCurrency(item.totalPrice || (item.quantity * item.unitPrice), selectedQuotation.currency || getCurrentSbuCurrency())}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="py-2.5 px-4 text-right font-semibold text-gray-700">
                        Grand Total:
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-lg font-bold text-primary text-right">
                        {formatCurrency(selectedQuotation.totalAmount, selectedQuotation.currency || getCurrentSbuCurrency())}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Additional Notes */}
            {selectedQuotation.notes && (
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Additional notes</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedQuotation.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

