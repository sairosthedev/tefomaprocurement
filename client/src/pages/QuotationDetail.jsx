import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { formatCurrency } from '../lib/constants';
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  DollarSign,
  Mail,
  Phone,
  ShoppingCart,
  Send,
  Package
} from 'lucide-react';
import Modal, { ConfirmModal } from '../components/Modal';

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700'
};

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComments, setRejectComments] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [poFormData, setPOFormData] = useState({
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

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const fetchQuotation = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getQuotation(id);
      if (response.data.success) {
        setQuotation(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching quotation:', error);
      showToast(error.response?.data?.message || 'Failed to load quotation details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      setProcessing(true);
      await procurementAPI.acceptQuotation(id, {});
      showToast('Quotation accepted successfully', 'success');
      setShowAcceptModal(false);
      fetchQuotation();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to accept quotation', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    try {
      setProcessing(true);
      await procurementAPI.rejectQuotation(id, {
        reason: rejectReason,
        comments: rejectComments
      });
      showToast('Quotation rejected successfully', 'success');
      setShowRejectModal(false);
      setRejectReason('');
      setRejectComments('');
      fetchQuotation();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to reject quotation', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreatePO = async () => {
    try {
      setProcessing(true);
      await procurementAPI.createPurchaseOrder({
        quotationId: id,
        ...poFormData
      });
      showToast('Purchase Order created successfully', 'success');
      setShowCreatePOModal(false);
      setPOFormData({
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
      fetchQuotation();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create purchase order', 'error');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Quotation not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/app/quotations')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotations
        </button>
      </div>

      {/* Hero Section with Green Background and SVG */}
      <div className="bg-gradient-to-br from-green-50 via-green-100/50 to-green-50 rounded-2xl p-8 border border-green-200 relative overflow-hidden mb-6">
        {/* Decorative SVG/Pattern */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
          <svg viewBox="0 0 200 200" className="w-full h-full text-green-600">
            <path d="M40,120 Q100,80 160,120 T280,120" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M40,140 Q100,100 160,140 T280,140" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="100" cy="130" r="20" fill="currentColor" opacity="0.2" />
            <circle cx="150" cy="110" r="15" fill="currentColor" opacity="0.15" />
          </svg>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-white/80 rounded-xl shadow-sm">
                  <FileText className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Quotation</h1>
                  <p className="text-sm text-gray-600 mt-1 font-mono">#{quotation.quotationNumber}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[quotation.status]}`}>
                {quotation.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
          {quotation.status === 'submitted' && (
            <>
              <button
                onClick={() => setShowAcceptModal(true)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Accept
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </>
          )}
          {quotation.status === 'accepted' && !quotation.existingPurchaseOrder && (
            <button
              onClick={() => setShowCreatePOModal(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Create Purchase Order
            </button>
          )}
          {quotation.existingPurchaseOrder && (
            <a
              href={`/app/purchase-orders/${quotation.existingPurchaseOrder._id}`}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              View Purchase Order
            </a>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quotation Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-500">Quotation Number</label>
              <p className="text-sm font-medium text-gray-900 mt-1 font-mono">{quotation.quotationNumber}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <p className="text-sm font-medium text-gray-900 mt-1 capitalize">
                {quotation.status?.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Total Amount</label>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {formatCurrency(quotation.totalAmount || 0)}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Currency</label>
              <p className="text-sm font-medium text-gray-900 mt-1">{quotation.currency || 'ZAR'}</p>
            </div>
          </div>
        </div>

        {/* Supplier Info */}
        {quotation.supplier && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Supplier Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Company Name</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{quotation.supplier.companyName}</p>
              </div>
              {quotation.supplier.contactEmail && (
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {quotation.supplier.contactEmail}
                  </p>
                </div>
              )}
              {quotation.supplier.contactPhone && (
                <div>
                  <label className="text-sm text-gray-500">Phone</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {quotation.supplier.contactPhone}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RFQ Info */}
        {quotation.rfq && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Related RFQ</h3>
            <p className="text-sm text-gray-700">
              <span className="font-medium">{quotation.rfq.rfqNumber}</span>
              {' - '}
              {quotation.rfq.title || quotation.rfq.description}
            </p>
            {quotation.rfq.submissionDeadline && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                Submission Deadline: {new Date(quotation.rfq.submissionDeadline).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Items */}
        {quotation.items && quotation.items.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quoted Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Description</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Quantity</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Unit</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Unit Price</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        {item.specifications && (
                          <p className="text-xs text-gray-500 mt-1">{item.specifications}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900">{item.quantity}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900">{item.unit}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900">
                        {formatCurrency(item.unitPrice || 0)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                        {formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan="4" className="py-3 px-4 text-right font-semibold text-gray-900">
                      Total Amount:
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">
                      {formatCurrency(quotation.totalAmount || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Submitted By */}
        {quotation.submittedBy && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Submitted By</h3>
            <p className="text-sm text-gray-700">
              {quotation.submittedBy.firstName} {quotation.submittedBy.lastName}
            </p>
            {quotation.submittedBy.email && (
              <p className="text-xs text-gray-500 mt-1">{quotation.submittedBy.email}</p>
            )}
            {quotation.submittedAt && (
              <p className="text-xs text-gray-500 mt-1">
                Submitted: {new Date(quotation.submittedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        {quotation.notes && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{quotation.notes}</p>
          </div>
        )}
      </div>

      {/* Accept Modal */}
      <Modal
        isOpen={showAcceptModal}
        onClose={() => setShowAcceptModal(false)}
        title="Accept Quotation"
      >
        <p className="text-gray-700 mb-6">Are you sure you want to accept this quotation?</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowAcceptModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={processing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Accept Quotation
          </button>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
          setRejectComments('');
        }}
        title="Reject Quotation"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason *
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Enter rejection reason"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comments</label>
            <textarea
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Additional comments (optional)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => {
              setShowRejectModal(false);
              setRejectReason('');
              setRejectComments('');
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={processing || !rejectReason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Reject Quotation
          </button>
        </div>
      </Modal>

      {/* Create PO Modal */}
      <Modal
        isOpen={showCreatePOModal}
        onClose={() => setShowCreatePOModal(false)}
        title="Create Purchase Order"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Street</label>
              <input
                type="text"
                value={poFormData.deliveryAddress.street}
                onChange={(e) => setPOFormData({
                  ...poFormData,
                  deliveryAddress: { ...poFormData.deliveryAddress, street: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <input
                type="text"
                value={poFormData.deliveryAddress.city}
                onChange={(e) => setPOFormData({
                  ...poFormData,
                  deliveryAddress: { ...poFormData.deliveryAddress, city: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Province</label>
              <input
                type="text"
                value={poFormData.deliveryAddress.province}
                onChange={(e) => setPOFormData({
                  ...poFormData,
                  deliveryAddress: { ...poFormData.deliveryAddress, province: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
              <input
                type="text"
                value={poFormData.deliveryAddress.postalCode}
                onChange={(e) => setPOFormData({
                  ...poFormData,
                  deliveryAddress: { ...poFormData.deliveryAddress, postalCode: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery Date</label>
            <input
              type="date"
              value={poFormData.expectedDeliveryDate}
              onChange={(e) => setPOFormData({ ...poFormData, expectedDeliveryDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Terms & Conditions</label>
            <textarea
              value={poFormData.termsAndConditions}
              onChange={(e) => setPOFormData({ ...poFormData, termsAndConditions: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={poFormData.notes}
              onChange={(e) => setPOFormData({ ...poFormData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowCreatePOModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePO}
            disabled={processing}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            Create Purchase Order
          </button>
        </div>
      </Modal>
    </div>
  );
}
