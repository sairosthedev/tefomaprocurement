import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import Modal, { ConfirmModal } from '../components/Modal';
import { formatCurrency } from '../lib/constants';
import Tabs from '../components/Tabs';
import PageHeader from '../components/PageHeader';
import { 
  Search, 
  FileText,
  Calendar,
  DollarSign,
  Loader2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Building2,
  Mail,
  Phone,
  ShoppingCart
} from 'lucide-react';
import ViewButton from '../components/ViewButton';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';

const statusColors: any = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700'
};

const statusIcons: any = {
  draft: Clock,
  submitted: FileText,
  under_review: Eye,
  accepted: CheckCircle,
  rejected: XCircle,
  expired: Clock
};

const statusLabels: any = {
  draft: 'Draft',
  submitted: 'Received from Supplier',
  under_review: 'Under Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired'
};

export default function Quotations() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [search, setSearch] = useState<any>('');
  const [statusFilter, setStatusFilter] = useState<any>(searchParams.get('status') || '');
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState<any>(false);
  const [showRejectModal, setShowRejectModal] = useState<any>(false);
  const [showCreatePOModal, setShowCreatePOModal] = useState<any>(false);
  const [rejectReason, setRejectReason] = useState<any>('');
  const [rejectComments, setRejectComments] = useState<any>('');
  const [processing, setProcessing] = useState<any>(false);
  const [poFormData, setPOFormData] = useState<any>({
    deliveryAddress: {
      street: '',
      city: '',
      province: '',
      postalCode: ''
    },
    expectedDeliveryDate: '',
    termsAndConditions: '',
    notes: ''
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchQuotations();
  }, [page, search, statusFilter]);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getQuotations({ 
        search, 
        status: statusFilter,
        page,
        limit: DEFAULT_PAGE_SIZE
      });
      setQuotations(response.data.data);
      setPagination(parsePagination(response.data.pagination));
    } catch (error: any) {
      console.error('Error fetching quotations:', error);
      showToast('Failed to load quotations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotationDetails = async (id: any) => {
    try {
      const response = await procurementAPI.getQuotation(id);
      setSelectedQuotation(response.data.data);
      setShowViewModal(true);
    } catch (error: any) {
      console.error('Error fetching quotation details:', error);
      if (error.response?.data?.sealed) {
        const rfqId = error.response.data.rfqId;
        showToast(error.response.data.message || 'This bid is sealed', 'error');
        if (rfqId) navigate(`/app/rfqs/${rfqId}`);
        return;
      }
      showToast(error.response?.data?.message || 'Failed to load quotation details', 'error');
    }
  };

  const openQuotation = (quotation: any) => {
    if (quotation.isSealed) {
      const rfqId = quotation.rfq?._id;
      showToast('This bid is sealed. Close the RFQ to reveal it for evaluation.', 'error');
      if (rfqId) navigate(`/app/rfqs/${rfqId}`);
      return;
    }
    navigate(`/app/quotations/${quotation._id}`);
  };

  const handleAccept = async () => {
    if (!selectedQuotation) return;
    
    try {
      setProcessing(true);
      await procurementAPI.acceptQuotation(selectedQuotation._id, {});
      showToast('Quotation accepted successfully', 'success');
      setShowViewModal(false);
      setSelectedQuotation(null);
      fetchQuotations();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to accept quotation', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedQuotation || !rejectReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    try {
      setProcessing(true);
      await procurementAPI.rejectQuotation(selectedQuotation._id, {
        reason: rejectReason,
        comments: rejectComments
      });
      showToast('Quotation rejected successfully', 'success');
      setShowRejectModal(false);
      setShowViewModal(false);
      setSelectedQuotation(null);
      setRejectReason('');
      setRejectComments('');
      fetchQuotations();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to reject quotation', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const canAcceptOrReject = (quotation: any) => {
    return quotation.status === 'submitted' || quotation.status === 'under_review';
  };

  const handleCreatePO = async () => {
    if (!selectedQuotation) return;
    
    if (!poFormData.expectedDeliveryDate) {
      showToast('Please select an expected delivery date', 'error');
      return;
    }

    try {
      setProcessing(true);
      await procurementAPI.createPurchaseOrder({
        quotationId: selectedQuotation._id,
        deliveryAddress: poFormData.deliveryAddress,
        expectedDeliveryDate: poFormData.expectedDeliveryDate,
        termsAndConditions: poFormData.termsAndConditions,
        notes: poFormData.notes
      });
      showToast('Purchase Order created successfully', 'success');
      setShowCreatePOModal(false);
      setShowViewModal(false);
      setSelectedQuotation(null);
      setPOFormData({
        deliveryAddress: { street: '', city: '', province: '', postalCode: '' },
        expectedDeliveryDate: '',
        termsAndConditions: '',
        notes: ''
      });
      // Optionally navigate to purchase orders page
      // navigate('/app/purchase-orders');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to create purchase order', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Quotations"
        subtitle="View and evaluate supplier quotations"
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search quotations..."
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>
          <Tabs
            tabs={[
              { value: '', label: 'All', icon: FileText },
              { value: 'submitted', label: 'Received', icon: FileText },
              { value: 'under_review', label: 'Under Review', icon: Eye },
              { value: 'accepted', label: 'Accepted', icon: CheckCircle },
              { value: 'rejected', label: 'Rejected', icon: XCircle }
            ]}
            activeTab={statusFilter}
            onTabChange={(value: any) => {
              setStatusFilter(value);
              if (value) {
                setSearchParams({ status: value });
              } else {
                setSearchParams({});
              }
            }}
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
            <h3 className="text-lg font-medium text-gray-900">No quotations found</h3>
            <p className="text-gray-500 mt-1">Quotations will appear here when suppliers respond to RFQs</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Quotation #
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    RFQ
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Valid Until
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotations.map((quotation: any) => {
                  const StatusIcon = statusIcons[quotation.status];
                  return (
                    <tr key={quotation._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{quotation.quotationNumber}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {quotation.rfq?.rfqNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {quotation.isSealed ? (
                          <span className="text-amber-600 font-medium">Sealed bid</span>
                        ) : (
                          quotation.supplier?.companyName
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {quotation.isSealed ? (
                          <span className="text-xs font-medium text-amber-600">Hidden until RFQ closes</span>
                        ) : (
                          <div className="flex items-center gap-1 font-semibold text-gray-900">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            {formatCurrency(quotation.totalAmount, quotation.currency || 'USD')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-ZA') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusColors[quotation.status]}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusLabels[quotation.status] || quotation.status.replace('_', ' ').charAt(0).toUpperCase() + quotation.status.replace('_', ' ').slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ViewButton
                          onClick={() => openQuotation(quotation)}
                          text={quotation.isSealed ? 'Sealed' : 'View'}
                        />
                      </td>
                    </tr>
                  );
                })}
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

      {/* View Quotation Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedQuotation(null);
        }}
        title="Quotation Details"
        size="xl"
      >
        {selectedQuotation && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Quotation Number</label>
                <p className="font-mono font-medium text-primary">{selectedQuotation.quotationNumber}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">RFQ Number</label>
                <p className="font-medium text-gray-900">{selectedQuotation.rfq?.rfqNumber}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusColors[selectedQuotation.status]}`}>
                  {statusLabels[selectedQuotation.status] || selectedQuotation.status.replace('_', ' ').charAt(0).toUpperCase() + selectedQuotation.status.replace('_', ' ').slice(1)}
                </span>
              </div>
              <div>
                <label className="text-sm text-gray-500">Total Amount</label>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedQuotation.totalAmount, selectedQuotation.currency || 'USD')}</p>
              </div>
            </div>

            {/* Supplier Info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Supplier Information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Company:</span>
                  <p className="font-medium text-gray-900">{selectedQuotation.supplier?.companyName}</p>
                </div>
                {selectedQuotation.supplier?.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">{selectedQuotation.supplier.contactEmail}</span>
                  </div>
                )}
                {selectedQuotation.supplier?.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">{selectedQuotation.supplier.contactPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quotation Terms */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-500">Delivery Period</label>
                <p className="font-medium text-gray-900">{selectedQuotation.deliveryPeriod} days</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Payment Terms</label>
                <p className="font-medium text-gray-900">{selectedQuotation.paymentTerms}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Valid Until</label>
                <p className="font-medium text-gray-900">
                  {selectedQuotation.validUntil ? new Date(selectedQuotation.validUntil).toLocaleDateString('en-ZA') : '-'}
                </p>
              </div>
            </div>

            {/* Items */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">Quoted Items</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Description</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Qty</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Unit Price</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedQuotation.items?.map((item: any, index: any) => (
                      <tr key={index}>
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-gray-900">{item.description}</p>
                          {item.brand && (
                            <p className="text-xs text-gray-500">Brand: {item.brand}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {formatCurrency(item.unitPrice, selectedQuotation.currency || 'USD')}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                          {formatCurrency(item.totalPrice, selectedQuotation.currency || 'USD')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 text-right font-semibold text-gray-700">
                        Subtotal:
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {formatCurrency(selectedQuotation.subtotal, selectedQuotation.currency || 'USD')}
                      </td>
                    </tr>
                    {selectedQuotation.vatAmount > 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 px-4 text-right font-semibold text-gray-700">
                          VAT (15%):
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          {formatCurrency(selectedQuotation.vatAmount, selectedQuotation.currency || 'USD')}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={3} className="py-3 px-4 text-right font-bold text-gray-900">
                        Total:
                      </td>
                      <td className="py-3 px-4 text-lg font-bold text-primary">
                        {formatCurrency(selectedQuotation.totalAmount, selectedQuotation.currency || 'USD')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {selectedQuotation.notes && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Notes</label>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedQuotation.notes}</p>
              </div>
            )}

            {/* Actions */}
            {canAcceptOrReject(selectedQuotation) && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setShowRejectModal(true);
                  }}
                  disabled={processing}
                  className="px-4 py-2.5 border border-red-300 text-red-700 font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={handleAccept}
                  disabled={processing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Accept Quotation
                </button>
              </div>
            )}

            {/* Create PO Button for Accepted Quotations */}
            {selectedQuotation.status === 'accepted' && (
              <div className="pt-4 border-t border-gray-100">
                {selectedQuotation.existingPurchaseOrder ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-800">Purchase Order Already Created</p>
                        <p className="text-sm text-green-600 mt-1">
                          PO Number: <span className="font-mono font-semibold">{selectedQuotation.existingPurchaseOrder.poNumber}</span>
                        </p>
                        <p className="text-xs text-green-500 mt-1">
                          Status: {selectedQuotation.existingPurchaseOrder.status.replace('_', ' ').charAt(0).toUpperCase() + selectedQuotation.existingPurchaseOrder.status.replace('_', ' ').slice(1)}
                        </p>
                      </div>
                      <button
                        onClick={() => window.location.href = '/app/purchase-orders'}
                        className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                      >
                        View PO
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        // Set default delivery date to quotation's delivery period
                        const deliveryDate = new Date();
                        deliveryDate.setDate(deliveryDate.getDate() + (selectedQuotation.deliveryPeriod || 7));
                        setPOFormData({
                          ...poFormData,
                          expectedDeliveryDate: deliveryDate.toISOString().split('T')[0]
                        });
                        setShowCreatePOModal(true);
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Create Purchase Order
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject Confirmation Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
          setRejectComments('');
        }}
        title="Reject Quotation"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={rejectReason}
              onChange={(e: any) => setRejectReason(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">Select a reason</option>
              <option value="Price too high">Price too high</option>
              <option value="Does not meet specifications">Does not meet specifications</option>
              <option value="Delivery period too long">Delivery period too long</option>
              <option value="Payment terms not acceptable">Payment terms not acceptable</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Comments
            </label>
            <textarea
              value={rejectComments}
              onChange={(e: any) => setRejectComments(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              placeholder="Provide additional details about the rejection..."
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setShowRejectModal(false);
                setRejectReason('');
                setRejectComments('');
              }}
              className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={processing || !rejectReason.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Reject Quotation
            </button>
          </div>
          </div>
        </Modal>

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={showCreatePOModal}
        onClose={() => {
          setShowCreatePOModal(false);
          setPOFormData({
            deliveryAddress: { street: '', city: '', province: '', postalCode: '' },
            expectedDeliveryDate: '',
            termsAndConditions: '',
            notes: ''
          });
        }}
        title="Create Purchase Order"
        size="lg"
      >
        {selectedQuotation && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>From Quotation:</strong> {selectedQuotation.quotationNumber} | 
                <strong> Supplier:</strong> {selectedQuotation.supplier?.companyName} | 
                <strong> Total:</strong> {formatCurrency(selectedQuotation.totalAmount, selectedQuotation.currency || 'USD')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Delivery Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={poFormData.expectedDeliveryDate}
                onChange={(e: any) => setPOFormData({ ...poFormData, expectedDeliveryDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Street Address"
                  value={poFormData.deliveryAddress.street}
                  onChange={(e: any) => setPOFormData({
                    ...poFormData,
                    deliveryAddress: { ...poFormData.deliveryAddress, street: e.target.value }
                  })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="City"
                    value={poFormData.deliveryAddress.city}
                    onChange={(e: any) => setPOFormData({
                      ...poFormData,
                      deliveryAddress: { ...poFormData.deliveryAddress, city: e.target.value }
                    })}
                    className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Province"
                    value={poFormData.deliveryAddress.province}
                    onChange={(e: any) => setPOFormData({
                      ...poFormData,
                      deliveryAddress: { ...poFormData.deliveryAddress, province: e.target.value }
                    })}
                    className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Postal Code"
                  value={poFormData.deliveryAddress.postalCode}
                  onChange={(e: any) => setPOFormData({
                    ...poFormData,
                    deliveryAddress: { ...poFormData.deliveryAddress, postalCode: e.target.value }
                  })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Terms & Conditions</label>
              <textarea
                value={poFormData.termsAndConditions}
                onChange={(e: any) => setPOFormData({ ...poFormData, termsAndConditions: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                placeholder="Additional terms and conditions for this purchase order..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={poFormData.notes}
                onChange={(e: any) => setPOFormData({ ...poFormData, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                placeholder="Internal notes for this purchase order..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowCreatePOModal(false);
                  setPOFormData({
                    deliveryAddress: { street: '', city: '', province: '', postalCode: '' },
                    expectedDeliveryDate: '',
                    termsAndConditions: '',
                    notes: ''
                  });
                }}
                className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePO}
                disabled={processing || !poFormData.expectedDeliveryDate}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                Create Purchase Order
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

