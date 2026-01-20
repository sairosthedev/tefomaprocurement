import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api, { departmentAPI } from '../lib/api';
import Tabs from '../components/Tabs';
import { 
  Plus, Search, Filter, Edit, Trash2, Send, 
  Clock, CheckCircle, XCircle, Package, Loader2, AlertCircle,
  Check, X, FileText, ShoppingCart, Truck
} from 'lucide-react';
import ViewButton from '../components/ViewButton';
import Modal from '../components/Modal';

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

export default function Requisitions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(''); // 'accept' or 'reject'
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);

  const isProcurement = user?.role === 'procurement_officer' || user?.role === 'admin';

  useEffect(() => {
    fetchRequisitions();
  }, [searchTerm, statusFilter, isProcurement]);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      // Use different endpoint based on role
      const endpoint = isProcurement ? '/procurement/requisitions' : '/department/requisitions';
      const response = await api.get(endpoint, {
        params: { search: searchTerm, status: statusFilter || undefined }
      });
      if (response.data.success) {
        setRequisitions(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch requisitions:', error);
      showToast('Failed to load requisitions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (id) => {
    try {
      setSubmittingId(id);
      await api.put(`/department/requisitions/${id}/submit`);
      showToast('Requisition submitted for acceptance', 'success');
      fetchRequisitions();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to submit', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleRequestFromStores = async (requisition) => {
    if (!requisition || !requisition.purchaseOrder) {
      showToast('Purchase order information not available', 'error');
      return;
    }

    try {
      // Create a store requisition for the items from the purchase order
      const items = requisition.purchaseOrder.items.map(poItem => ({
        description: poItem.description,
        quantityRequested: poItem.quantity - (poItem.quantityReceived || 0),
        unit: poItem.unit || 'Each'
      })).filter(item => item.quantityRequested > 0);

      if (items.length === 0) {
        showToast('All items have already been received', 'info');
        return;
      }

      await departmentAPI.createStoreRequisition({
        purpose: `Request items from Purchase Order ${requisition.purchaseOrder.poNumber} for Requisition ${requisition.requisitionNumber}`,
        items: items,
        priority: requisition.priority || 'medium'
      });

      showToast('Store requisition created successfully', 'success');
      fetchRequisitions();
    } catch (error) {
      console.error('Error creating store requisition:', error);
      showToast(error.response?.data?.message || 'Failed to create store requisition', 'error');
    }
  };

  const handleAction = async () => {
    if (actionType === 'reject' && !actionComment.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const endpoint = `/procurement/requisitions/${selectedRequisition._id}/${actionType}`;
      await api.put(endpoint, { 
        comments: actionComment,
        reason: actionComment 
      });
      showToast(
        actionType === 'accept' ? 'Requisition accepted' : 'Requisition rejected', 
        'success'
      );
      setShowActionModal(false);
      setActionComment('');
      fetchRequisitions();
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${actionType}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openActionModal = (req, type) => {
    setSelectedRequisition(req);
    setActionType(type);
    setActionComment('');
    setShowActionModal(true);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isProcurement ? 'Purchase Requisitions' : 'My Requisitions'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isProcurement 
              ? 'Accept or reject requisitions from departments' 
              : 'Track your purchase requests'}
          </p>
        </div>
        {!isProcurement && (
          <button
            onClick={() => navigate('/app/requisitions/create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-5 w-5" />
            New Requisition
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search requisitions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <Tabs
            tabs={[
              { value: '', label: 'All', icon: FileText },
              ...(!isProcurement ? [{ value: 'draft', label: 'Draft', icon: Clock }] : []),
              { value: 'pending_acceptance', label: 'Pending Acceptance', icon: Clock },
              { value: 'accepted', label: 'Accepted', icon: CheckCircle },
              { value: 'rejected', label: 'Rejected', icon: XCircle },
              { value: 'sourcing', label: 'Sourcing', icon: Search },
              { value: 'quoted', label: 'Quoted', icon: FileText },
              { value: 'ordered', label: 'Ordered', icon: ShoppingCart },
              { value: 'completed', label: 'Completed', icon: CheckCircle }
            ]}
            activeTab={statusFilter}
            onTabChange={setStatusFilter}
            variant="pills"
          />
        </div>
      </div>

      {/* Stats for Procurement */}
      {isProcurement && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-600 font-medium">Pending Acceptance</p>
            <p className="text-2xl font-bold text-amber-700">
              {requisitions.filter(r => r.status === 'pending_acceptance').length}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-600 font-medium">Accepted</p>
            <p className="text-2xl font-bold text-green-700">
              {requisitions.filter(r => r.status === 'accepted' && !r.purchaseOrder).length}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-600 font-medium">In Sourcing</p>
            <p className="text-2xl font-bold text-blue-700">
              {requisitions.filter(r => r.status === 'sourcing' && !r.purchaseOrder).length}
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <p className="text-sm text-purple-600 font-medium">Ordered</p>
            <p className="text-2xl font-bold text-purple-700">
              {requisitions.filter(r => r.purchaseOrder || r.status === 'ordered').length}
            </p>
          </div>
        </div>
      )}

      {/* Requisitions List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : requisitions.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {isProcurement ? 'No requisitions to process' : 'No requisitions found'}
            </p>
            {!isProcurement && (
              <button
                onClick={() => navigate('/app/requisitions/create')}
                className="mt-4 text-primary font-medium hover:underline"
              >
                Create your first requisition
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">REQ #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Title</th>
                  {isProcurement && (
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Requested By</th>
                  )}
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Items</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Priority</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">PO Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requisitions.map((req) => (
                  <tr key={req._id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-medium text-primary">
                        {req.requisitionNumber || `REQ-${req._id.slice(-6).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-medium text-gray-900">{req.title || 'Untitled'}</p>
                      <p className="text-sm text-gray-500 truncate max-w-xs">
                        {req.justification || req.description || 'No description'}
                      </p>
                    </td>
                    {isProcurement && (
                      <td className="py-4 px-6">
                        <p className="text-sm text-gray-900">
                          {req.requestedBy?.firstName} {req.requestedBy?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{req.department?.name || 'No dept'}</p>
                      </td>
                    )}
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">{req.items?.length || 0} items</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${priorityColors[req.priority] || priorityColors.medium}`}>
                        {req.priority || 'Medium'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {/* Show computed status: if PO exists, show 'ordered', if delivered to stores, show appropriate status */}
                      {(() => {
                        let displayStatus = req.status;
                        if (req.purchaseOrder) {
                          displayStatus = 'ordered';
                        } else if (req.itemsDeliveredToStores) {
                          displayStatus = 'ordered'; // Will show as delivered in PO Status column
                        }
                        return (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[displayStatus] || statusColors.draft}`}>
                            {statusLabels[displayStatus] || displayStatus}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-4 px-6">
                      {req.purchaseOrder ? (
                        <div className="flex flex-col gap-1">
                          <div className="font-mono text-sm font-semibold text-primary">
                            {req.purchaseOrder.poNumber}
                          </div>
                          {req.purchaseOrder.supplier?.companyName && (
                            <div className="text-xs text-gray-600">
                              {req.purchaseOrder.supplier.companyName}
                            </div>
                          )}
                          {req.purchaseOrder.status === 'pending_approvals' ? (
                            <div className="flex flex-col gap-0.5 mt-1">
                              <span className={`text-xs ${req.purchaseOrder.financeApproved ? 'text-green-700' : 'text-amber-700'}`}>
                                Finance: {req.purchaseOrder.financeApproved ? 'Approved' : 'Pending'}
                              </span>
                              <span className={`text-xs ${req.purchaseOrder.cooApproved ? 'text-green-700' : 'text-purple-700'}`}>
                                COO: {req.purchaseOrder.cooApproved ? 'Approved' : 'Pending'}
                              </span>
                            </div>
                          ) : req.itemsDeliveredToStores ? (
                            <div className="flex flex-col gap-0.5 mt-1">
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                ✅ Delivered to Stores
                              </span>
                            </div>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                              req.purchaseOrder.status === 'approved' ? 'bg-green-100 text-green-700' :
                              req.purchaseOrder.status === 'issued' ? 'bg-blue-100 text-blue-700' :
                              req.purchaseOrder.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              req.purchaseOrder.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {req.purchaseOrder.status === 'pending_finance' ? 'Pending Finance' :
                               req.purchaseOrder.status === 'pending_coo' ? 'Pending COO' :
                               req.purchaseOrder.status === 'pending_approvals' ? 'Pending Approvals' :
                               req.purchaseOrder.status === 'approved' ? 'Approved' :
                               req.purchaseOrder.status === 'issued' ? 'Issued' :
                               req.purchaseOrder.status === 'rejected' ? 'Rejected' :
                               req.purchaseOrder.status === 'draft' ? 'Draft' :
                               req.purchaseOrder.status}
                            </span>
                          )}
                        </div>
                      ) : req.status === 'ordered' ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          ⏳ PO Pending
                        </span>
                      ) : req.status === 'quoted' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                            📋 Quotations Received
                          </span>
                          {req.rfq?.rfqNumber && (
                            <span className="text-xs text-gray-500 font-mono">
                              {req.rfq.rfqNumber}
                            </span>
                          )}
                        </div>
                      ) : req.status === 'sourcing' && req.rfq ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            🔍 RFQ Created
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            {req.rfq.rfqNumber}
                          </span>
                        </div>
                      ) : req.status === 'sourcing' ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          🔍 Sourcing
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {new Date(req.createdAt).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <ViewButton
                          onClick={() => navigate(`/app/requisitions/${req._id}`)}
                        />
                        
                        {/* Department Head Actions */}
                        {!isProcurement && req.status === 'draft' && (
                          <>
                            <button
                              onClick={() => navigate(`/app/requisitions/edit/${req._id}`)}
                              className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleSubmit(req._id)}
                              disabled={submittingId === req._id}
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Submit for Acceptance"
                            >
                              {submittingId === req._id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Submitting...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4" />
                                  <span>Submit</span>
                                </>
                              )}
                            </button>
                          </>
                        )}

                        {/* Procurement Actions */}
                        {isProcurement && req.status === 'pending_acceptance' && (
                          <>
                            <button
                              onClick={() => openActionModal(req, 'accept')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Accept"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openActionModal(req, 'reject')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {isProcurement && req.status === 'accepted' && (
                          <button
                            onClick={() => navigate(`/app/rfqs/create?requisition=${req._id}`)}
                            className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark"
                          >
                            Create RFQ
                          </button>
                        )}

                        {/* Request from Stores Button - Show when items are delivered to stores but not yet collected */}
                        {!isProcurement && req.itemsDeliveredToStores && !req.itemsCollected && (
                          <button
                            onClick={() => handleRequestFromStores(req)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark"
                            title="Request items from stores"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            Request from Stores
                          </button>
                        )}
                        {/* Collected Badge - Show when items have been collected */}
                        {!isProcurement && req.itemsCollected && (
                          <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-lg">
                            ✓ Collected
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Requisition Details"
        size="lg"
      >
        {selectedRequisition && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Requisition Number</label>
                <p className="font-mono font-medium text-primary">
                  {selectedRequisition.requisitionNumber || `REQ-${selectedRequisition._id.slice(-6).toUpperCase()}`}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[selectedRequisition.status]}`}>
                    {statusLabels[selectedRequisition.status] || selectedRequisition.status}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Priority</label>
                <p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${priorityColors[selectedRequisition.priority] || priorityColors.medium}`}>
                    {selectedRequisition.priority || 'Medium'}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Requested By</label>
                <p className="text-gray-900">
                  {selectedRequisition.requestedBy?.firstName} {selectedRequisition.requestedBy?.lastName}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Department</label>
                <p className="text-gray-900">{selectedRequisition.department?.name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Created</label>
                <p className="text-gray-900">{new Date(selectedRequisition.createdAt).toLocaleDateString('en-ZA')}</p>
              </div>
            </div>

            {/* Purchase Order Status */}
            {selectedRequisition.purchaseOrder && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Purchase Order Status</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="text-sm text-gray-600">PO Number</label>
                    <p className="font-mono font-medium text-primary text-lg">
                      {selectedRequisition.purchaseOrder.poNumber}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">PO Status</label>
                    <p>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        selectedRequisition.purchaseOrder.status === 'pending_approvals' ? 'bg-blue-100 text-blue-700' :
                        selectedRequisition.purchaseOrder.status === 'approved' ? 'bg-green-100 text-green-700' :
                        selectedRequisition.purchaseOrder.status === 'issued' ? 'bg-blue-100 text-blue-700' :
                        selectedRequisition.purchaseOrder.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {selectedRequisition.purchaseOrder.status === 'pending_approvals' ? '⏳ Pending Approvals' :
                         selectedRequisition.purchaseOrder.status === 'pending_finance' ? 'Pending Finance' :
                         selectedRequisition.purchaseOrder.status === 'pending_coo' ? 'Pending COO' :
                         selectedRequisition.purchaseOrder.status === 'approved' ? 'Approved' :
                         selectedRequisition.purchaseOrder.status === 'issued' ? 'Issued' :
                         selectedRequisition.purchaseOrder.status === 'rejected' ? 'Rejected' :
                         selectedRequisition.purchaseOrder.status}
                      </span>
                    </p>
                  </div>
                </div>
                {selectedRequisition.purchaseOrder.status === 'pending_approvals' && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <p className="text-sm font-medium text-gray-700 mb-2">Approval Progress:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`rounded-lg p-2.5 ${selectedRequisition.purchaseOrder.financeApproved ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Finance</span>
                          {selectedRequisition.purchaseOrder.financeApproved ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                        <p className={`text-xs ${selectedRequisition.purchaseOrder.financeApproved ? 'text-green-700' : 'text-amber-700'}`}>
                          {selectedRequisition.purchaseOrder.financeApproved ? 'Approved' : 'Pending Approval'}
                        </p>
                        {selectedRequisition.purchaseOrder.financeApprovedAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(selectedRequisition.purchaseOrder.financeApprovedAt).toLocaleDateString('en-ZA')}
                          </p>
                        )}
                      </div>
                      <div className={`rounded-lg p-2.5 ${selectedRequisition.purchaseOrder.cooApproved ? 'bg-green-50 border border-green-200' : 'bg-purple-50 border border-purple-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">COO</span>
                          {selectedRequisition.purchaseOrder.cooApproved ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-purple-600" />
                          )}
                        </div>
                        <p className={`text-xs ${selectedRequisition.purchaseOrder.cooApproved ? 'text-green-700' : 'text-purple-700'}`}>
                          {selectedRequisition.purchaseOrder.cooApproved ? 'Approved' : 'Pending Approval'}
                        </p>
                        {selectedRequisition.purchaseOrder.cooApprovedAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(selectedRequisition.purchaseOrder.cooApprovedAt).toLocaleDateString('en-ZA')}
                          </p>
                        )}
                      </div>
                    </div>
                    {!selectedRequisition.purchaseOrder.financeApproved || !selectedRequisition.purchaseOrder.cooApproved ? (
                      <p className="text-xs text-amber-700 mt-3 italic">
                        ⏳ Purchase Order is awaiting approval from {!selectedRequisition.purchaseOrder.financeApproved && !selectedRequisition.purchaseOrder.cooApproved ? 'Finance and COO' : !selectedRequisition.purchaseOrder.financeApproved ? 'Finance' : 'COO'}
                      </p>
                    ) : (
                      <p className="text-xs text-green-700 mt-3 font-medium">
                        ✓ All approvals complete. Purchase Order is ready to be issued.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Delivered to Stores Status */}
            {selectedRequisition.itemsDeliveredToStores && (
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">Items Available in Stores</h3>
                </div>
                {selectedRequisition.itemsCollected ? (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-2 bg-emerald-100 text-emerald-700 font-medium rounded-lg">
                      ✓ Items Collected
                    </span>
                    <p className="text-sm text-green-800">
                      {isProcurement 
                        ? `Items have been collected by ${selectedRequisition.department?.name || 'the department'}.`
                        : 'Your items have been collected from stores.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-green-800 mb-3">
                      {isProcurement
                        ? `Ordered items have been received and are now available in stores for ${selectedRequisition.department?.name || 'the requesting department'}.`
                        : 'Your ordered items have been received and are now available in stores. You can request them using the button below.'}
                    </p>
                    {!isProcurement && (
                      <button
                        onClick={() => {
                          handleRequestFromStores(selectedRequisition);
                          setShowViewModal(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark"
                      >
                        <Truck className="h-4 w-4" />
                        Request from Stores
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Purchase Order Status */}
            {selectedRequisition.purchaseOrder && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Purchase Order Status</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="text-sm text-gray-600">PO Number</label>
                    <p className="font-mono font-medium text-primary text-lg">
                      {selectedRequisition.purchaseOrder.poNumber}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">PO Status</label>
                    <p>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        selectedRequisition.purchaseOrder.status === 'pending_approvals' ? 'bg-blue-100 text-blue-700' :
                        selectedRequisition.purchaseOrder.status === 'approved' ? 'bg-green-100 text-green-700' :
                        selectedRequisition.purchaseOrder.status === 'issued' ? 'bg-blue-100 text-blue-700' :
                        selectedRequisition.purchaseOrder.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {selectedRequisition.purchaseOrder.status === 'pending_approvals' ? '⏳ Pending Approvals' :
                         selectedRequisition.purchaseOrder.status === 'pending_finance' ? 'Pending Finance' :
                         selectedRequisition.purchaseOrder.status === 'pending_coo' ? 'Pending COO' :
                         selectedRequisition.purchaseOrder.status === 'approved' ? 'Approved' :
                         selectedRequisition.purchaseOrder.status === 'issued' ? 'Issued' :
                         selectedRequisition.purchaseOrder.status === 'rejected' ? 'Rejected' :
                         selectedRequisition.purchaseOrder.status}
                      </span>
                    </p>
                  </div>
                </div>
                {selectedRequisition.purchaseOrder.status === 'pending_approvals' && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <p className="text-sm font-medium text-gray-700 mb-2">Approval Progress:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`rounded-lg p-2.5 ${selectedRequisition.purchaseOrder.financeApproved ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Finance</span>
                          {selectedRequisition.purchaseOrder.financeApproved ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                        <p className={`text-xs ${selectedRequisition.purchaseOrder.financeApproved ? 'text-green-700' : 'text-amber-700'}`}>
                          {selectedRequisition.purchaseOrder.financeApproved ? 'Approved' : 'Pending Approval'}
                        </p>
                        {selectedRequisition.purchaseOrder.financeApprovedAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(selectedRequisition.purchaseOrder.financeApprovedAt).toLocaleDateString('en-ZA')}
                          </p>
                        )}
                      </div>
                      <div className={`rounded-lg p-2.5 ${selectedRequisition.purchaseOrder.cooApproved ? 'bg-green-50 border border-green-200' : 'bg-purple-50 border border-purple-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">COO</span>
                          {selectedRequisition.purchaseOrder.cooApproved ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-purple-600" />
                          )}
                        </div>
                        <p className={`text-xs ${selectedRequisition.purchaseOrder.cooApproved ? 'text-green-700' : 'text-purple-700'}`}>
                          {selectedRequisition.purchaseOrder.cooApproved ? 'Approved' : 'Pending Approval'}
                        </p>
                        {selectedRequisition.purchaseOrder.cooApprovedAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(selectedRequisition.purchaseOrder.cooApprovedAt).toLocaleDateString('en-ZA')}
                          </p>
                        )}
                      </div>
                    </div>
                    {!selectedRequisition.purchaseOrder.financeApproved || !selectedRequisition.purchaseOrder.cooApproved ? (
                      <p className="text-xs text-amber-700 mt-3 italic">
                        ⏳ Purchase Order is awaiting approval from {!selectedRequisition.purchaseOrder.financeApproved && !selectedRequisition.purchaseOrder.cooApproved ? 'Finance and COO' : !selectedRequisition.purchaseOrder.financeApproved ? 'Finance' : 'COO'}
                      </p>
                    ) : (
                      <p className="text-xs text-green-700 mt-3 font-medium">
                        ✓ All approvals complete. Purchase Order is ready to be issued.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-sm text-gray-500">Justification</label>
              <p className="text-gray-900">{selectedRequisition.justification || selectedRequisition.description || 'No justification provided'}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Items</label>
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
                    {selectedRequisition.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm">{item.description || item.name}</td>
                        <td className="py-3 px-4 text-sm">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-4 text-sm text-gray-500">{item.specification || item.specifications || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRequisition.statusHistory?.length > 0 && (
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Status History</label>
                <div className="space-y-2">
                  {selectedRequisition.statusHistory.map((history, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {history.action === 'accepted' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : history.action === 'rejected' ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-500" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{history.action}</p>
                        <p className="text-xs text-gray-500">
                          {history.comments}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400">
                        {new Date(history.timestamp).toLocaleString('en-ZA')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accept/Reject buttons in modal for Procurement */}
            {isProcurement && selectedRequisition.status === 'pending_acceptance' && (
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => { setShowViewModal(false); openActionModal(selectedRequisition, 'accept'); }}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark"
                >
                  Accept Requisition
                </button>
                <button
                  onClick={() => { setShowViewModal(false); openActionModal(selectedRequisition, 'reject'); }}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700"
                >
                  Reject Requisition
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Accept/Reject Action Modal */}
      <Modal
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        title={actionType === 'accept' ? 'Accept Requisition' : 'Reject Requisition'}
      >
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600">
              {actionType === 'accept' 
                ? 'You are about to accept this requisition. It will be available for RFQ creation.'
                : 'You are about to reject this requisition. The department will be notified.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {actionType === 'accept' ? 'Comments (Optional)' : 'Reason for Rejection (Required)'}
            </label>
            <textarea
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder={actionType === 'accept' ? 'Add any comments...' : 'Please provide a reason...'}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowActionModal(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAction}
              disabled={actionLoading}
              className={`flex-1 py-2.5 text-white rounded-xl font-medium ${
                actionType === 'accept' 
                  ? 'bg-primary hover:bg-primary-dark' 
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50`}
            >
              {actionLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : actionType === 'accept' ? (
                'Accept'
              ) : (
                'Reject'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
