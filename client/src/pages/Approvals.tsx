import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { 
  CheckCircle, XCircle, Eye, Loader2, Clock, 
  DollarSign, FileText, AlertTriangle, Package, ShoppingCart
} from 'lucide-react';
import Modal from '../components/Modal';
import { formatCurrency } from '../lib/constants';

const statusColors = {
  pending_finance: 'bg-amber-100 text-amber-700',
  pending_coo: 'bg-purple-100 text-purple-700',
  pending_approvals: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700'
};

const statusLabels = {
  pending_finance: 'Awaiting Finance',
  pending_coo: 'Awaiting COO',
  pending_approvals: 'Pending Approvals',
  approved: 'Approved',
  rejected: 'Rejected'
};

export default function Approvals() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      let endpoint = '';
      
      switch (user?.role) {
        case 'finance':
          endpoint = '/finance/pending-approvals';
          break;
        case 'coo':
          endpoint = '/coo/pending-approvals';
          break;
        case 'admin':
          // Admin can see all pending POs
          endpoint = '/procurement/purchase-orders?status=pending_approvals';
          break;
        default:
          endpoint = '/finance/pending-approvals';
      }
      
      const response = await api.get(endpoint);
      if (response.data.success) {
        setPendingItems(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
      showToast('Failed to load pending approvals', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      let endpoint = '';
      
      switch (user?.role) {
        case 'finance':
        case 'admin':
          endpoint = `/finance/purchase-orders/${selectedItem._id}/approve`;
          break;
        case 'coo':
          endpoint = `/coo/purchase-orders/${selectedItem._id}/approve`;
          break;
        default:
          return;
      }
      
      await api.put(endpoint, { comments: comment });
      showToast('Purchase Order approved successfully', 'success');
      setShowModal(false);
      setComment('');
      fetchPendingApprovals();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to approve', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }
    
    try {
      setActionLoading(true);
      let endpoint = '';
      
      switch (user?.role) {
        case 'finance':
        case 'admin':
          endpoint = `/finance/purchase-orders/${selectedItem._id}/reject`;
          break;
        case 'coo':
          endpoint = `/coo/purchase-orders/${selectedItem._id}/reject`;
          break;
        default:
          return;
      }
      
      await api.put(endpoint, { reason: comment, comments: comment });
      showToast('Purchase Order rejected', 'success');
      setShowModal(false);
      setComment('');
      fetchPendingApprovals();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to reject', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getTitle = () => {
    switch (user?.role) {
      case 'finance':
        return 'Finance Approval';
      case 'coo':
        return 'Executive Approval';
      default:
        return 'Purchase Order Approvals';
    }
  };

  const getDescription = () => {
    switch (user?.role) {
      case 'finance':
        return 'Review and approve purchase orders for payment authorization';
      case 'coo':
        return 'Final approval for high-value purchase orders';
      default:
        return 'Review pending purchase orders';
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{getTitle()}</h1>
        <p className="text-gray-500 mt-1">{getDescription()}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600 font-medium">Pending Approval</p>
              <p className="text-2xl font-bold text-amber-700">{pendingItems.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Value</p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(pendingItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0))}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-xl">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-red-600 font-medium">High Value (≥$10,000)</p>
              <p className="text-2xl font-bold text-red-700">
                {pendingItems.filter(item => (item.totalAmount || 0) >= 10000).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Approvals List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No pending approvals</p>
            <p className="text-sm text-gray-400 mt-1">All purchase orders are processed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">PO Number</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Supplier</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Items</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Value</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Created</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingItems.map((item) => (
                  <tr key={item._id} className={`hover:bg-gray-50 ${(item.totalAmount || 0) >= 10000 ? 'bg-red-50/30' : ''}`}>
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-medium text-primary">
                        {item.poNumber || `PO-${item._id.slice(-6).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-medium text-gray-900">
                        {item.supplier?.companyName || 'Unknown Supplier'}
                      </p>
                      <p className="text-sm text-gray-500">{item.supplier?.contactEmail}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">{item.items?.length || 0} items</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`font-semibold ${(item.totalAmount || 0) >= 10000 ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatCurrency(item.totalAmount || 0)}
                      </span>
                      {(item.totalAmount || 0) >= 10000 && (
                        <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">High Value</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {item.status === 'pending_approvals' ? (
                        <div className="flex flex-col gap-1">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.financeApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            Finance: {item.financeApproved ? 'Approved' : 'Pending'}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.cooApproved ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                            COO: {item.cooApproved ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[item.status] || statusColors.pending_finance}`}>
                          {statusLabels[item.status] || item.status}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => { setSelectedItem(item); setShowModal(true); }}
                        className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setComment(''); }}
        title="Review Purchase Order"
        size="lg"
      >
        {selectedItem && (
          <div className="space-y-6">
            {/* PO Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">PO Number</label>
                <p className="font-mono font-medium text-primary">
                  {selectedItem.poNumber || `PO-${selectedItem._id.slice(-6).toUpperCase()}`}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Date Created</label>
                <p className="text-gray-900">{new Date(selectedItem.createdAt).toLocaleDateString('en-ZA')}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Supplier</label>
                <p className="text-gray-900 font-medium">{selectedItem.supplier?.companyName}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Total Value</label>
                <p className={`text-xl font-bold ${(selectedItem.totalAmount || 0) >= 10000 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatCurrency(selectedItem.totalAmount || 0)}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Payment Terms</label>
                <p className="text-gray-900">{selectedItem.paymentTerms || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Expected Delivery</label>
                <p className="text-gray-900">
                  {selectedItem.expectedDeliveryDate 
                    ? new Date(selectedItem.expectedDeliveryDate).toLocaleDateString('en-ZA')
                    : 'Not specified'}
                </p>
              </div>
            </div>

            {/* Approval Status */}
            {selectedItem.status === 'pending_approvals' && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-sm font-medium text-blue-800 mb-3">Approval Status</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-lg p-3 ${selectedItem.financeApproved ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Finance</span>
                      {selectedItem.financeApproved ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-600" />
                      )}
                    </div>
                    <p className={`text-xs mt-1 ${selectedItem.financeApproved ? 'text-green-700' : 'text-amber-700'}`}>
                      {selectedItem.financeApproved ? 'Approved' : 'Pending'}
                    </p>
                    {selectedItem.financeApprovedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(selectedItem.financeApprovedAt).toLocaleDateString('en-ZA')}
                      </p>
                    )}
                  </div>
                  <div className={`rounded-lg p-3 ${selectedItem.cooApproved ? 'bg-green-50 border border-green-200' : 'bg-purple-50 border border-purple-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">COO</span>
                      {selectedItem.cooApproved ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <p className={`text-xs mt-1 ${selectedItem.cooApproved ? 'text-green-700' : 'text-purple-700'}`}>
                      {selectedItem.cooApproved ? 'Approved' : 'Pending'}
                    </p>
                    {selectedItem.cooApprovedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(selectedItem.cooApprovedAt).toLocaleDateString('en-ZA')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* High Value Warning */}
            {(selectedItem.totalAmount || 0) >= 10000 && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">High Value Purchase Order</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  This PO exceeds $10,000. Please review carefully before approval.
                </p>
              </div>
            )}

            {/* Items */}
            <div>
              <label className="text-sm text-gray-500 mb-2 block">Line Items</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Description</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Qty</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Unit Price</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedItem.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm">{item.description}</td>
                        <td className="py-3 px-4 text-sm">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-4 text-sm">{formatCurrency(item.unitPrice || 0)}</td>
                        <td className="py-3 px-4 text-sm font-medium">{formatCurrency(item.totalPrice || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 text-sm font-medium text-right">Subtotal:</td>
                      <td className="py-3 px-4 text-sm font-medium">{formatCurrency(selectedItem.subtotal || 0)}</td>
                    </tr>
                    {selectedItem.vatAmount > 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 px-4 text-sm font-medium text-right">VAT:</td>
                        <td className="py-3 px-4 text-sm font-medium">{formatCurrency(selectedItem.vatAmount || 0)}</td>
                      </tr>
                    )}
                    <tr className="border-t border-gray-200">
                      <td colSpan={3} className="py-3 px-4 text-sm font-bold text-right">Total:</td>
                      <td className="py-3 px-4 text-sm font-bold">{formatCurrency(selectedItem.totalAmount || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Previous Approvals (for COO) */}
            {user?.role === 'coo' && selectedItem.approvalHistory?.length > 0 && (
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Approval History</label>
                <div className="space-y-2">
                  {selectedItem.approvalHistory.filter(h => h.action === 'finance_approved').map((history, index) => (
                    <div key={index} className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Finance Approved</span>
                      </div>
                      <p className="text-sm text-green-600 mt-1">
                        {history.comments && `"${history.comments}"`}
                      </p>
                      <p className="text-xs text-green-500 mt-1">
                        {new Date(history.timestamp).toLocaleString('en-ZA')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comments (required for rejection)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                placeholder="Add your comments or reason for decision..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => { setShowModal(false); setComment(''); }}
                className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Approve
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
