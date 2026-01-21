import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api, { storesAPI, departmentAPI } from '../lib/api';
import { 
  Plus, Search, Package, CheckCircle, XCircle, 
  Loader2, Clock, Truck, AlertCircle
} from 'lucide-react';
import ViewButton from '../components/ViewButton';
import Modal from '../components/Modal';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  issued: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  partial: 'bg-purple-100 text-purple-700',
  'out-of-stock': 'bg-gray-100 text-gray-700'
};

export default function StoreRequisitions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    items: [{ itemCode: '', description: '', quantity: 1 }]
  });

  const isStoresOfficer = user?.role === 'stores_officer';

  useEffect(() => {
    fetchRequisitions();
  }, [searchTerm]);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      const response = isStoresOfficer 
        ? await storesAPI.getStoreRequisitions({ search: searchTerm })
        : await departmentAPI.getStoreRequisitions({ search: searchTerm });
      
      if (response.data.success) {
        setRequisitions(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch store requisitions:', error);
      showToast('Failed to fetch store requisitions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const validItems = formData.items.filter(item => item.description.trim());
      if (validItems.length === 0) {
        showToast('Please add at least one item', 'error');
        return;
      }

      await api.post('/department/store-requisitions', { items: validItems });
      showToast('Store requisition submitted', 'success');
      setShowCreateModal(false);
      setFormData({ items: [{ itemCode: '', description: '', quantity: 1 }] });
      fetchRequisitions();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create requisition', 'error');
    }
  };

  const handleApprove = async () => {
    if (!selectedRequisition) return;
    
    try {
      setActionLoading(true);
      await storesAPI.approveStoreRequisition(selectedRequisition._id, { 
        comments: actionComment.trim() || undefined 
      });
      showToast('Store requisition approved successfully', 'success');
      setShowApproveModal(false);
      setActionComment('');
      setSelectedRequisition(null);
      fetchRequisitions();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to approve requisition', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequisition || !actionComment.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }
    
    try {
      setActionLoading(true);
      await storesAPI.rejectStoreRequisition(selectedRequisition._id, { 
        comments: actionComment.trim() 
      });
      showToast('Store requisition rejected', 'success');
      setShowRejectModal(false);
      setActionComment('');
      setSelectedRequisition(null);
      fetchRequisitions();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to reject requisition', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssue = async (id) => {
    try {
      await storesAPI.issueStock(id, {});
      showToast('Items issued successfully', 'success');
      fetchRequisitions();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to issue items', 'error');
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { itemCode: '', description: '', quantity: 1 }]
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Requisitions</h1>
          <p className="text-gray-500 mt-1">
            {isStoresOfficer ? 'Process department stock requests' : 'Request items from stores'}
          </p>
        </div>
        {!isStoresOfficer && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-5 w-5" />
            Request from Store
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search requisitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : requisitions.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No store requisitions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">SR #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">
                    {isStoresOfficer ? 'Requested By' : 'Items'}
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requisitions.map((req) => (
                  <tr key={req._id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-medium text-primary">
                        {req.requisitionNumber || `SR-${req._id.slice(-6).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {isStoresOfficer ? (
                        <div>
                          <p className="font-medium text-gray-900">
                            {req.requestedBy?.firstName} {req.requestedBy?.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{req.department?.name}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">{req.items?.length || 0} items</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[req.status] || statusColors.pending}`}>
                        {req.status || 'Pending'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {new Date(req.createdAt).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <ViewButton
                          onClick={() => { setSelectedRequisition(req); setShowViewModal(true); }}
                        />
                        {isStoresOfficer && req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedRequisition(req);
                                setShowApproveModal(true);
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequisition(req);
                                setShowRejectModal(true);
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {isStoresOfficer && req.status === 'approved' && (
                          <button
                            onClick={() => handleIssue(req._id)}
                            className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark"
                          >
                            Issue Items
                          </button>
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

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Request from Store"
      >
        <div className="space-y-4">
          {formData.items.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Item Description</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="e.g., A4 Paper"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="w-full py-2 text-sm text-primary font-medium hover:bg-primary/5 rounded-lg"
          >
            + Add Another Item
          </button>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark"
            >
              Submit Request
            </button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Requisition Details"
      >
        {selectedRequisition && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">Requisition #</label>
              <p className="font-mono font-medium">
                {selectedRequisition.requisitionNumber || `SR-${selectedRequisition._id.slice(-6).toUpperCase()}`}
              </p>
            </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[selectedRequisition.status]}`}>
                    {selectedRequisition.status}
                  </span>
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Purpose</label>
              <p className="text-sm text-gray-700 mb-4">{selectedRequisition.purpose || 'N/A'}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Items Requested</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Item</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Qty Requested</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Qty Issued</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedRequisition.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm">
                          {item.item?.name || item.item?.description || item.description || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-sm">{item.quantityRequested || item.quantity || '-'}</td>
                        <td className="py-3 px-4 text-sm">{item.quantityIssued || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setActionComment('');
          setSelectedRequisition(null);
        }}
        title="Approve Store Requisition"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to approve this store requisition? This will allow the items to be issued.
          </p>
          
          <div>
            <label className="block text-sm text-gray-700 mb-2">Comments (optional)</label>
            <textarea
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Add any comments about this approval..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setShowApproveModal(false);
                setActionComment('');
                setSelectedRequisition(null);
              }}
              disabled={actionLoading}
              className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setActionComment('');
          setSelectedRequisition(null);
        }}
        title="Reject Store Requisition"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this store requisition.
          </p>
          
          <div>
            <label className="block text-sm text-gray-700 mb-2">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={3}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Explain why this requisition is being rejected..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setShowRejectModal(false);
                setActionComment('');
                setSelectedRequisition(null);
              }}
              disabled={actionLoading}
              className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading || !actionComment.trim()}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Reject
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

