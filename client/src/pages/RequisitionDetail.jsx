import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { departmentAPI, procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
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
  ShoppingCart,
  Package,
  User,
  Send,
  Truck,
  PackageCheck
} from 'lucide-react';

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

const statusLabels = {
  draft: 'Draft',
  pending_acceptance: 'Pending Acceptance',
  accepted: 'Accepted',
  rejected: 'Rejected',
  sourcing: 'Sourcing',
  quoted: 'Quoted',
  ordered: 'Ordered',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600'
};

export default function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requisition, setRequisition] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isProcurement = user?.role === 'procurement_officer' || user?.role === 'admin';
  const isDepartment = user?.role === 'department_head' || user?.role === 'admin';

  useEffect(() => {
    fetchRequisition();
  }, [id]);

  const fetchRequisition = async () => {
    try {
      setLoading(true);
      const endpoint = isProcurement ? `/procurement/requisitions/${id}` : `/department/requisitions/${id}`;
      const response = await api.get(endpoint);
      if (response.data.success) {
        setRequisition(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching requisition:', error);
      showToast(error.response?.data?.message || 'Failed to load requisition details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await departmentAPI.submitRequisition(id);
      showToast('Requisition submitted successfully', 'success');
      fetchRequisition();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to submit requisition', 'error');
    } finally {
      setSubmitting(false);
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

  if (!requisition) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Requisition not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Back Button */}
      <button
        onClick={() => navigate('/app/requisitions')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Requisitions
      </button>

      {/* Header Card with Green Background and SVG */}
      <div className="bg-gradient-to-br from-green-50 via-green-100/50 to-green-50 rounded-2xl p-8 border border-green-200 relative overflow-hidden mb-8">
        {/* Decorative SVG Pattern */}
        <div className="absolute top-0 right-0 w-80 h-80 opacity-10">
          <svg viewBox="0 0 300 300" className="w-full h-full text-green-600">
            <circle cx="150" cy="150" r="80" fill="currentColor" opacity="0.1" />
            <circle cx="100" cy="100" r="40" fill="currentColor" opacity="0.15" />
            <circle cx="200" cy="200" r="50" fill="currentColor" opacity="0.1" />
            <path
              d="M50,150 Q150,50 250,150 T450,150"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              opacity="0.2"
            />
            <path
              d="M50,200 Q150,100 250,200 T450,200"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              opacity="0.15"
            />
          </svg>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/90 rounded-2xl shadow-sm">
                <PackageCheck className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">{requisition.title || 'Requisition'}</h1>
                <p className="text-sm text-gray-600 font-mono">#{requisition.requisitionNumber || `REQ-${requisition._id?.slice(-6).toUpperCase()}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[requisition.status]}`}>
                {statusLabels[requisition.status] || requisition.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              {isDepartment && requisition.status === 'draft' && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Submit
                </button>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/90 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-xs text-gray-600 mb-1">Items</p>
              <p className="text-2xl font-bold text-gray-900">{requisition.items?.length || 0}</p>
            </div>
            <div className="bg-white/90 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-xs text-gray-600 mb-1">Department</p>
              <p className="text-sm font-semibold text-gray-900">{requisition.department?.name || 'N/A'}</p>
            </div>
            <div className="bg-white/90 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-xs text-gray-600 mb-1">Priority</p>
              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${priorityColors[requisition.priority] || priorityColors.medium}`}>
                {requisition.priority || 'Medium'}
              </span>
            </div>
            <div className="bg-white/90 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-xs text-gray-600 mb-1">Date</p>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(requisition.createdAt).toLocaleDateString('en-ZA')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {(requisition.description || requisition.justification) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                {requisition.justification || requisition.description || 'No description provided'}
              </p>
            </div>
          )}

          {/* Items */}
          {requisition.items && requisition.items.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Requested Items</h2>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Item</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Quantity</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Specification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requisition.items.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-gray-900">{item.description || item.name}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-gray-900">{item.quantity} {item.unit}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-gray-500">{item.specification || item.specifications || '-'}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status History */}
          {requisition.statusHistory && requisition.statusHistory.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>
              <div className="space-y-3">
                {requisition.statusHistory.map((history, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    {history.action === 'accepted' ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : history.action === 'rejected' ? (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize text-gray-900">{history.action}</p>
                      {history.comments && (
                        <p className="text-xs text-gray-600 mt-1">{history.comments}</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(history.timestamp).toLocaleString('en-ZA')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Status Cards */}
        <div className="space-y-6">
          {/* Purchase Order Status */}
          {requisition.purchaseOrder && (
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Purchase Order</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600">PO Number</label>
                  <p className="font-mono font-bold text-primary text-lg mt-1">
                    {requisition.purchaseOrder.poNumber}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Status</label>
                  <p className="mt-1">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      requisition.purchaseOrder.status === 'pending_approvals' ? 'bg-blue-100 text-blue-700' :
                      requisition.purchaseOrder.status === 'approved' ? 'bg-green-100 text-green-700' :
                      requisition.purchaseOrder.status === 'issued' ? 'bg-blue-100 text-blue-700' :
                      requisition.purchaseOrder.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {requisition.purchaseOrder.status === 'pending_approvals' ? '⏳ Pending Approvals' :
                       requisition.purchaseOrder.status === 'approved' ? '✅ Approved' :
                       requisition.purchaseOrder.status === 'issued' ? '📦 Issued' :
                       requisition.purchaseOrder.status === 'rejected' ? '❌ Rejected' :
                       requisition.purchaseOrder.status}
                    </span>
                  </p>
                </div>
                {requisition.purchaseOrder.status === 'pending_approvals' && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100 space-y-3">
                    <p className="text-xs font-medium text-gray-700">Approval Progress:</p>
                    <div className="space-y-2">
                      <div className={`rounded-lg p-2.5 ${requisition.purchaseOrder.financeApproved ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">Finance</span>
                          {requisition.purchaseOrder.financeApproved ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                        <p className={`text-xs ${requisition.purchaseOrder.financeApproved ? 'text-green-700' : 'text-amber-700'}`}>
                          {requisition.purchaseOrder.financeApproved ? 'Approved' : 'Pending'}
                        </p>
                      </div>
                      <div className={`rounded-lg p-2.5 ${requisition.purchaseOrder.cooApproved ? 'bg-green-50 border border-green-200' : 'bg-purple-50 border border-purple-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">COO</span>
                          {requisition.purchaseOrder.cooApproved ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-purple-600" />
                          )}
                        </div>
                        <p className={`text-xs ${requisition.purchaseOrder.cooApproved ? 'text-green-700' : 'text-purple-700'}`}>
                          {requisition.purchaseOrder.cooApproved ? 'Approved' : 'Pending'}
                        </p>
                      </div>
                    </div>
                    {!requisition.purchaseOrder.financeApproved || !requisition.purchaseOrder.cooApproved ? (
                      <p className="text-xs text-amber-700 mt-2 italic">
                        ⏳ Awaiting approval from {!requisition.purchaseOrder.financeApproved && !requisition.purchaseOrder.cooApproved ? 'Finance and COO' : !requisition.purchaseOrder.financeApproved ? 'Finance' : 'COO'}
                      </p>
                    ) : (
                      <p className="text-xs text-green-700 mt-2 font-medium">
                        ✓ All approvals complete
                      </p>
                    )}
                  </div>
                )}
                <a
                  href={`/app/purchase-orders/${requisition.purchaseOrder._id}`}
                  className="block w-full text-center py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                >
                  View Purchase Order
                </a>
              </div>
            </div>
          )}

          {/* Delivered to Stores */}
          {requisition.itemsDeliveredToStores && (
            <div className="bg-green-50 rounded-2xl p-6 border border-green-200">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Items in Stores</h3>
              </div>
              {requisition.itemsCollected ? (
                <div className="space-y-2">
                  <span className="inline-block px-3 py-2 bg-emerald-100 text-emerald-700 font-medium rounded-lg text-sm">
                    ✓ Items Collected
                  </span>
                  <p className="text-sm text-green-800">
                    Your items have been collected from stores.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-green-800">
                    Your ordered items have been received and are available in stores.
                  </p>
                  {!isProcurement && (
                    <button
                      onClick={() => navigate('/app/store-requisitions')}
                      className="w-full py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                    >
                      <Truck className="h-4 w-4" />
                      Request from Stores
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Requested By */}
          {requisition.requestedBy && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-gray-900">Requested By</h3>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  {requisition.requestedBy.firstName} {requisition.requestedBy.lastName}
                </p>
                {requisition.requestedBy.email && (
                  <p className="text-xs text-gray-500">{requisition.requestedBy.email}</p>
                )}
              </div>
            </div>
          )}

          {/* RFQ Info */}
          {requisition.rfq && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-gray-900">Related RFQ</h3>
              </div>
              <div className="space-y-2">
                <p className="font-mono font-medium text-primary text-sm">
                  {requisition.rfq.rfqNumber}
                </p>
                {requisition.rfq.title && (
                  <p className="text-xs text-gray-600">{requisition.rfq.title}</p>
                )}
                {requisition.rfq.submissionDeadline && (
                  <p className="text-xs text-gray-500 mt-1">
                    Deadline: {new Date(requisition.rfq.submissionDeadline).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
