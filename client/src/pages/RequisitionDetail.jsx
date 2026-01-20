import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { procurementAPI, departmentAPI } from '../lib/api';
import Modal from '../components/Modal';
import { 
  ArrowLeft, FileText, ShoppingCart, Truck, Package, 
  Clock, CheckCircle, XCircle, User, Building2, 
  Calendar, DollarSign, Loader2, Eye, ExternalLink,
  Send, Plus, ClipboardList, Target, AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../lib/constants';

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  pending_acceptance: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  sourcing: 'bg-blue-100 text-blue-700',
  quoted: 'bg-indigo-100 text-indigo-700',
  ordered: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500'
};

export default function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requisition, setRequisition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCreateRFQModal, setShowCreateRFQModal] = useState(false);
  const [comments, setComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const isProcurement = user?.role === 'procurement_officer' || user?.role === 'admin';
  const isDepartment = user?.role === 'department_head' || user?.role === 'admin';

  useEffect(() => {
    fetchRequisition();
  }, [id]);

  const fetchRequisition = async () => {
    try {
      setLoading(true);
      const response = isProcurement 
        ? await procurementAPI.getRequisitionById(id)
        : await departmentAPI.getRequisitionById(id);
      
      if (response.data.success && response.data.data) {
        setRequisition(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch requisition:', error);
      showToast(error.response?.data?.message || 'Failed to load requisition details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequisition = async () => {
    try {
      setActionLoading(true);
      const response = await departmentAPI.submitRequisition(id);
      if (response.data.success) {
        showToast('Requisition submitted successfully', 'success');
        fetchRequisition();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to submit requisition', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequisition = async () => {
    try {
      setActionLoading(true);
      const response = await procurementAPI.acceptRequisition(id, { comments });
      if (response.data.success) {
        showToast('Requisition accepted successfully', 'success');
        setShowAcceptModal(false);
        setComments('');
        fetchRequisition();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to accept requisition', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequisition = async () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const response = await procurementAPI.rejectRequisition(id, { reason: rejectReason });
      if (response.data.success) {
        showToast('Requisition rejected', 'success');
        setShowRejectModal(false);
        setRejectReason('');
        fetchRequisition();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to reject requisition', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRFQ = () => {
    navigate(`/app/rfqs/create?requisitionId=${id}`);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!requisition) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate('/app/requisitions')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Requisitions
        </button>
        <div className="text-center py-12">
          <p className="text-gray-500">Requisition not found</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending_acceptance':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'sourcing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'quoted':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'ordered':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-500 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="p-8 pb-0">
        <button
          onClick={() => navigate('/app/requisitions')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Requisitions
        </button>
      </div>

      {/* Professional Header with Texture */}
      <div className="px-8 pb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-dark to-primary shadow-2xl">
          {/* Texture Overlay */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}></div>
          
          {/* Content */}
          <div className="relative px-8 py-10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <ClipboardList className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium uppercase tracking-wider mb-1">Purchase Requisition</p>
                    <h1 className="text-4xl font-bold text-white mb-2">
                      {requisition.requisitionNumber || `REQ-${requisition._id.slice(-6).toUpperCase()}`}
                    </h1>
                    <p className="text-white/90 text-lg">{requisition.title || 'Untitled Requisition'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 mt-6">
                  <div className="flex items-center gap-2 text-white/90">
                    <Calendar className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {new Date(requisition.createdAt).toLocaleDateString('en-ZA', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-white/90">
                    <Building2 className="h-5 w-5" />
                    <span className="text-sm font-medium">{requisition.department?.name || 'N/A'}</span>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full border-2 backdrop-blur-sm ${getStatusColor(requisition.status)}`}>
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {requisition.status?.replace('_', ' ') || 'Draft'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-6">
                {isDepartment && requisition.status === 'draft' && (
                  <button
                    onClick={handleSubmitRequisition}
                    disabled={actionLoading}
                    className="flex items-center gap-2 bg-white hover:bg-gray-50 text-primary font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                    Submit Requisition
                  </button>
                )}
                {isProcurement && requisition.status === 'pending_acceptance' && (
                  <>
                    <button
                      onClick={() => setShowAcceptModal(true)}
                      disabled={actionLoading}
                      className="flex items-center gap-2 bg-white hover:bg-gray-50 text-green-700 font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="h-5 w-5" />
                      Accept
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="flex items-center gap-2 bg-white hover:bg-gray-50 text-red-700 font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="h-5 w-5" />
                      Reject
                    </button>
                  </>
                )}
                {isProcurement && requisition.status === 'accepted' && !requisition.rfq && (
                  <button
                    onClick={handleCreateRFQ}
                    className="flex items-center gap-2 bg-white hover:bg-gray-50 text-primary font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl"
                  >
                    <Plus className="h-5 w-5" />
                    Create RFQ
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Items Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  Requested Items ({requisition.items?.length || 0})
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {requisition.items?.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all bg-gray-50/50">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">{item.description}</h3>
                          {item.specifications && (
                            <p className="text-sm text-gray-600 mt-1">{item.specifications}</p>
                          )}
                        </div>
                        {item.estimatedCost && (
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">
                              {formatCurrency(item.estimatedCost, 'USD')}
                            </p>
                            <p className="text-xs text-gray-500">Estimated</p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quantity</p>
                          <p className="font-semibold text-gray-900">{item.quantity} {item.unit || 'Each'}</p>
                        </div>
                        {item.estimatedCost && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Estimated Cost</p>
                            <p className="font-semibold text-primary">{formatCurrency(item.estimatedCost, 'USD')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Purchase Order Section */}
            {requisition.purchaseOrder && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                      </div>
                      Purchase Order
                    </h2>
                    <button
                      onClick={() => navigate(`/app/purchase-orders/${requisition.purchaseOrder._id}`)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">PO Number</label>
                      <p className="font-mono font-bold text-primary text-lg">
                        {requisition.purchaseOrder.poNumber}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Supplier</label>
                      <p className="font-semibold text-gray-900">
                        {requisition.purchaseOrder.supplier?.companyName || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Status</label>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        requisition.purchaseOrder.status === 'approved' ? 'bg-green-100 text-green-800' :
                        requisition.purchaseOrder.status === 'pending_approvals' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {requisition.purchaseOrder.status?.replace('_', ' ')}
                      </span>
                    </div>
                    {requisition.purchaseOrder.totalAmount && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Total Amount</label>
                        <p className="font-bold text-primary text-lg">
                          {formatCurrency(requisition.purchaseOrder.totalAmount, requisition.purchaseOrder.quotation?.currency || 'USD')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* RFQ Section */}
            {requisition.rfq && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      Request for Quotation
                    </h2>
                    <button
                      onClick={() => navigate(`/app/rfqs/${requisition.rfq._id || requisition.rfq}`)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">RFQ Number</label>
                  <p className="font-mono font-bold text-primary text-lg">
                    {requisition.rfq.rfqNumber || requisition.rfq}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Requisition Details */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  Requisition Details
                </h3>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Requested By</label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <p className="font-semibold text-gray-900">
                      {requisition.requestedBy?.firstName} {requisition.requestedBy?.lastName}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Department</label>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <p className="font-semibold text-gray-900">{requisition.department?.name || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Priority</label>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    requisition.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    requisition.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                    requisition.priority === 'low' ? 'bg-gray-100 text-gray-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {requisition.priority === 'urgent' && <AlertCircle className="h-3 w-3" />}
                    {requisition.priority === 'high' && <Target className="h-3 w-3" />}
                    {requisition.priority?.charAt(0).toUpperCase() + requisition.priority?.slice(1) || 'Medium'}
                  </span>
                </div>

                {requisition.requiredDate && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Required Date</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <p className="font-semibold text-gray-900">
                        {new Date(requisition.requiredDate).toLocaleDateString('en-ZA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {requisition.estimatedTotal && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Estimated Total</label>
                    <p className="font-bold text-primary text-xl">
                      {formatCurrency(requisition.estimatedTotal, 'USD')}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Created Date</label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p className="font-semibold text-gray-900">
                      {new Date(requisition.createdAt).toLocaleDateString('en-ZA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {requisition.justification && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Justification</label>
                    <p className="text-sm text-gray-700 leading-relaxed">{requisition.justification}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accept Requisition Modal */}
      <Modal
        isOpen={showAcceptModal}
        onClose={() => {
          setShowAcceptModal(false);
          setComments('');
        }}
        title="Accept Requisition"
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
              placeholder="Add any comments about accepting this requisition..."
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
              onClick={handleAcceptRequisition}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Accepting...' : 'Accept Requisition'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Requisition Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
        }}
        title="Reject Requisition"
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
              placeholder="Please provide a reason for rejecting this requisition..."
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
              onClick={handleRejectRequisition}
              disabled={actionLoading || !rejectReason.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Rejecting...' : 'Reject Requisition'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

