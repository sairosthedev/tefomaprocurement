import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { procurementAPI } from '../lib/api';
import Modal from '../components/Modal';
import { 
  ArrowLeft, FileText, Package, Building2, 
  Calendar, DollarSign, Loader2, ExternalLink,
  CheckCircle, XCircle, ShoppingCart
} from 'lucide-react';
import { formatCurrency } from '../lib/constants';

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [comments, setComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const fetchQuotation = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getQuotation(id);
      
      if (response.data.success && response.data.data) {
        setQuotation(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch quotation:', error);
      showToast(error.response?.data?.message || 'Failed to load quotation details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isProcurement = user?.role === 'procurement_officer' || user?.role === 'admin';

  const handleAcceptQuotation = async () => {
    try {
      setActionLoading(true);
      const response = await procurementAPI.acceptQuotation(id, { comments });
      if (response.data.success) {
        showToast('Quotation accepted successfully', 'success');
        setShowAcceptModal(false);
        setComments('');
        fetchQuotation();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to accept quotation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectQuotation = async () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const response = await procurementAPI.rejectQuotation(id, { reason: rejectReason });
      if (response.data.success) {
        showToast('Quotation rejected', 'success');
        setShowRejectModal(false);
        setRejectReason('');
        fetchQuotation();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to reject quotation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePurchaseOrder = async () => {
    try {
      setActionLoading(true);
      const response = await procurementAPI.createPurchaseOrder({
        quotationId: id
      });
      if (response.data.success) {
        showToast('Purchase Order created successfully', 'success');
        setShowCreatePOModal(false);
        navigate(`/app/purchase-orders/${response.data.data._id}`);
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create purchase order', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate('/app/quotations')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotations
        </button>
        <div className="text-center py-12">
          <p className="text-gray-500">Quotation not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/app/quotations')}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Quotations
      </button>
      
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{quotation.quotationNumber}</h1>
            <p className="text-gray-600 mt-1">Quotation Details</p>
          </div>
          {isProcurement && (
            <div className="flex items-center gap-2">
              {(quotation.status === 'submitted' || quotation.status === 'under_review') && (
                <>
                  <button
                    onClick={() => setShowAcceptModal(true)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </>
              )}
              {quotation.status === 'accepted' && !quotation.existingPurchaseOrder && (
                <button
                  onClick={() => setShowCreatePOModal(true)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  Create Purchase Order
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-primary" />
              Items ({quotation.items?.length || 0})
            </h2>
            <div className="space-y-4">
              {quotation.items?.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{item.description}</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Quantity:</span>
                      <span className="ml-2 font-medium">{item.quantity} {item.unit || 'Each'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Unit Price:</span>
                      <span className="ml-2 font-medium">{formatCurrency(item.unitPrice, quotation.currency || 'USD')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total:</span>
                      <span className="ml-2 font-medium">{formatCurrency(item.totalPrice, quotation.currency || 'USD')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Related RFQ */}
          {quotation.rfq && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Related RFQ
                </h2>
                <button
                  onClick={() => navigate(`/app/rfqs/${quotation.rfq._id || quotation.rfq}`)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  View RFQ
                </button>
              </div>
              <div>
                <p className="font-mono font-medium text-primary">
                  {quotation.rfq.rfqNumber || quotation.rfq}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Supplier</label>
                <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                  <Building2 className="h-4 w-4" />
                  {quotation.supplier?.companyName || 'N/A'}
                </p>
              </div>
              {quotation.totalAmount && (
                <div>
                  <label className="text-sm text-gray-500">Total Amount</label>
                  <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(quotation.totalAmount, quotation.currency || 'USD')}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm text-gray-500">Submitted</label>
                <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  {quotation.submittedAt ? new Date(quotation.submittedAt).toLocaleDateString('en-ZA') : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accept Quotation Modal */}
      <Modal
        isOpen={showAcceptModal}
        onClose={() => {
          setShowAcceptModal(false);
          setComments('');
        }}
        title="Accept Quotation"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments (Optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Add any comments about accepting this quotation..."
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setShowAcceptModal(false);
                setComments('');
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAcceptQuotation}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Accepting...' : 'Accept Quotation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Quotation Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
        }}
        title="Reject Quotation"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Please provide a reason for rejecting this quotation..."
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setShowRejectModal(false);
                setRejectReason('');
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectQuotation}
              disabled={actionLoading || !rejectReason.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Rejecting...' : 'Reject Quotation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={showCreatePOModal}
        onClose={() => setShowCreatePOModal(false)}
        title="Create Purchase Order"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to create a Purchase Order from this accepted quotation?
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This will create a new Purchase Order that will require Finance and COO approvals.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setShowCreatePOModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePurchaseOrder}
              disabled={actionLoading}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


