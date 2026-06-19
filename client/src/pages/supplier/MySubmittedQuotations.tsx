import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import Tabs from '../../components/Tabs';
import { 
  FileText, Loader2, CheckCircle, XCircle, Clock, 
  Search, Calendar, DollarSign, Package, AlertCircle,
  Eye, Download, TrendingUp, Award
} from 'lucide-react';
import ViewButton from '../../components/ViewButton';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination';
import { formatCurrency } from '../../lib/constants';

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
  const [searchTerm, setSearchTerm] = useState<any>('');
  const [statusFilter, setStatusFilter] = useState<any>('');
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState<any>(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchQuotations();
  }, [page, searchTerm, statusFilter]);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/supplier/quotations', {
        params: { 
          status: statusFilter || undefined,
          search: searchTerm || undefined,
          page,
          limit: DEFAULT_PAGE_SIZE
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
    { value: '', label: 'All', icon: FileText, count: quotations.length },
    { value: 'submitted', label: 'Submitted', icon: Clock, count: quotations.filter((q: any) => q.status === 'submitted').length },
    { value: 'under_review', label: 'Under Review', icon: Eye, count: quotations.filter((q: any) => q.status === 'under_review').length },
    { value: 'accepted', label: 'Accepted', icon: CheckCircle, count: quotations.filter((q: any) => q.status === 'accepted' || q.status === 'awarded').length },
    { value: 'rejected', label: 'Rejected', icon: XCircle, count: quotations.filter((q: any) => q.status === 'rejected').length }
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
                  quotations[0]?.currency || 'USD'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by quotation number, RFQ number, or title..."
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <Tabs
            tabs={quotationStatusTabs}
            activeTab={statusFilter}
            onTabChange={setStatusFilter}
            variant="pills"
          />
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No quotations found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm || statusFilter ? 'Try adjusting your filters' : 'Submit your first quotation to get started'}
            </p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Quotation #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">RFQ Details</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Total Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Delivery Period</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Submitted Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotations.map((quote: any) => (
                  <tr key={quote._id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-medium text-primary">
                        {quote.quotationNumber || `QT-${quote._id.slice(-6).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-gray-900">{quote.rfq?.title || 'N/A'}</p>
                        <p className="text-sm text-gray-500 font-mono">{quote.rfq?.rfqNumber || 'N/A'}</p>
                        {quote.rfq?.submissionDeadline && (
                          <p className="text-xs text-gray-400 mt-1">
                            Deadline: {new Date(quote.rfq.submissionDeadline).toLocaleDateString('en-ZA')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <span className="font-semibold text-gray-900 text-lg">
                          {formatCurrency(quote.totalAmount, quote.currency || 'USD')}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{quote.currency || 'USD'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Package className="h-4 w-4" />
                        <span>{quote.deliveryPeriod || quote.deliveryDays || 'N/A'} days</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
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
                    <td className="py-4 px-6">
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
                    <td className="py-4 px-6">
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
            </table>
          </div>
          <Pagination
            page={page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
            itemLabel="quotations"
          />
          </>
        )}
      </div>

      {/* View Details Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Quotation Details"
        size="xl"
      >
        {selectedQuotation && (
          <div className="space-y-6">
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

            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 font-medium">Quotation Number</label>
                <p className="font-mono text-lg font-bold text-primary mt-1">
                  {selectedQuotation.quotationNumber || `QT-${selectedQuotation._id.slice(-6).toUpperCase()}`}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">Status</label>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[selectedQuotation.status] || statusColors.submitted}`}>
                    {statusLabels[selectedQuotation.status] || selectedQuotation.status?.replace('_', ' ') || 'Submitted'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">RFQ Number</label>
                <p className="font-mono text-gray-900 mt-1">{selectedQuotation.rfq?.rfqNumber || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">RFQ Title</label>
                <p className="text-gray-900 mt-1">{selectedQuotation.rfq?.title || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">Total Amount</label>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(selectedQuotation.totalAmount, selectedQuotation.currency || 'USD')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">Currency</label>
                <p className="text-gray-900 mt-1">{selectedQuotation.currency || 'USD'}</p>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Financial Breakdown</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Subtotal</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(selectedQuotation.subtotal || selectedQuotation.totalAmount, selectedQuotation.currency || 'USD')}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">VAT Amount</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(selectedQuotation.vatAmount || 0, selectedQuotation.currency || 'USD')}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Grand Total</label>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(selectedQuotation.totalAmount, selectedQuotation.currency || 'USD')}
                  </p>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-500 font-medium">Delivery Period</label>
                <p className="text-gray-900 mt-1">
                  {selectedQuotation.deliveryPeriod || selectedQuotation.deliveryDays || 'N/A'} days
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">Payment Terms</label>
                <p className="text-gray-900 mt-1">{selectedQuotation.paymentTerms || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">Valid Until</label>
                <p className="text-gray-900 mt-1">
                  {selectedQuotation.validUntil 
                    ? new Date(selectedQuotation.validUntil).toLocaleDateString('en-ZA')
                    : selectedQuotation.validityPeriod 
                      ? new Date(new Date(selectedQuotation.submittedAt || selectedQuotation.createdAt).getTime() + selectedQuotation.validityPeriod * 86400000).toLocaleDateString('en-ZA')
                      : 'N/A'}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <label className="text-sm text-gray-500 font-medium mb-3 block">Quoted Items</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Item Description</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Quantity</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Unit</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Unit Price</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Brand</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedQuotation.items?.map((item: any, index: any) => (
                      <tr key={index}>
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-gray-900">{item.description}</p>
                          {item.notes && (
                            <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.quantity}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.unit}</td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {formatCurrency(item.unitPrice, selectedQuotation.currency || 'USD')}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.brand || '-'}</td>
                        <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">
                          {formatCurrency(item.totalPrice || (item.quantity * item.unitPrice), selectedQuotation.currency || 'USD')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="py-3 px-4 text-right font-semibold text-gray-700">
                        Grand Total:
                      </td>
                      <td className="py-3 px-4 text-lg font-bold text-primary text-right">
                        {formatCurrency(selectedQuotation.totalAmount, selectedQuotation.currency || 'USD')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Additional Notes */}
            {selectedQuotation.notes && (
              <div>
                <label className="text-sm text-gray-500 font-medium mb-2 block">Additional Notes</label>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedQuotation.notes}</p>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="border-t border-gray-200 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-gray-500">Submitted Date</label>
                  <p className="text-gray-900 mt-1">
                    {new Date(selectedQuotation.submittedAt || selectedQuotation.createdAt).toLocaleString('en-ZA')}
                  </p>
                </div>
                {selectedQuotation.updatedAt && selectedQuotation.updatedAt !== selectedQuotation.createdAt && (
                  <div>
                    <label className="text-gray-500">Last Updated</label>
                    <p className="text-gray-900 mt-1">
                      {new Date(selectedQuotation.updatedAt).toLocaleString('en-ZA')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

