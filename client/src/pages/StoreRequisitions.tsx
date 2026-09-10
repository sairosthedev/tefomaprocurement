import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api, { storesAPI, departmentAPI } from '../lib/api';
import { 
  Plus, Search, Package, CheckCircle, XCircle, 
  Loader2, Clock, Truck, AlertCircle
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import ViewButton from '../components/ViewButton';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { ItemSelect } from '../components/ItemSelect';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';

const statusColors: any = {
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
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [searchTerm, setSearchTerm] = useState<any>('');
  const [showCreateModal, setShowCreateModal] = useState<any>(false);
  const [showViewModal, setShowViewModal] = useState<any>(false);
  const [showApproveModal, setShowApproveModal] = useState<any>(false);
  const [showRejectModal, setShowRejectModal] = useState<any>(false);
  const [showIssueModal, setShowIssueModal] = useState<any>(false);
  const [collectedBy, setCollectedBy] = useState({
    name: '',
    idNumber: '',
    department: '',
    contactNumber: ''
  });
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [selectedRequisition, setSelectedRequisition] = useState<any>(null);
  const [actionComment, setActionComment] = useState<any>('');
  const [actionLoading, setActionLoading] = useState<any>(false);
  const [formData, setFormData] = useState<any>({
    items: [{ itemId: '', itemCode: '', description: '', quantity: 1, catalogItem: null }]
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());

  const isStoresOfficer = user?.role === 'stores_officer';

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchRequisitions();
  }, [page, searchTerm]);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      const response = isStoresOfficer 
        ? await storesAPI.getStoreRequisitions({ search: searchTerm, page, limit: DEFAULT_PAGE_SIZE })
        : await departmentAPI.getStoreRequisitions({ search: searchTerm, page, limit: DEFAULT_PAGE_SIZE });
      
      if (response.data.success) {
        setRequisitions(response.data.data || []);
        setPagination(parsePagination(response.data.pagination));
      }
    } catch (error: any) {
      console.error('Failed to fetch store requisitions:', error);
      showToast('Failed to fetch store requisitions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const validItems = formData.items.filter((item: any) => item.description.trim());
      if (validItems.length === 0) {
        showToast('Please add at least one item', 'error');
        return;
      }

      // Send only what the API expects. catalogItem is view state — the link is
      // carried by itemId, which lets the server use the picked item directly
      // instead of re-matching it by name.
      await api.post('/department/store-requisitions', {
        items: validItems.map((item: any) => ({
          itemId: item.itemId || undefined,
          itemCode: item.itemCode || undefined,
          description: item.description,
          quantity: item.quantity
        }))
      });
      showToast('Store requisition submitted', 'success');
      setShowCreateModal(false);
      setFormData({ items: [{ itemId: '', itemCode: '', description: '', quantity: 1, catalogItem: null }] });
      fetchRequisitions();
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to reject requisition', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Issue the stock, recording who collected it.
   *
   * The collector is optional so an issue is never blocked, but it is asked for
   * every time: stock leaving the store is a custody hand-over, and without it
   * nothing evidences who took the goods.
   */
  const handleIssue = async () => {
    if (!selectedRequisition) return;
    try {
      setActionLoading(true);
      await storesAPI.issueStock(selectedRequisition._id, {
        collectedBy: collectedBy.name.trim()
          ? {
              name: collectedBy.name.trim(),
              idNumber: collectedBy.idNumber.trim() || undefined,
              department: collectedBy.department.trim() || undefined,
              contactNumber: collectedBy.contactNumber.trim() || undefined
            }
          : undefined
      });
      showToast('Items issued successfully', 'success');
      setShowIssueModal(false);
      setCollectedBy({ name: '', idNumber: '', department: '', contactNumber: '' });
      fetchRequisitions();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to issue items', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /** Open the signed issue note for goods that have already left the store. */
  const handlePrintIssueNote = async (requisition: any) => {
    try {
      setPrintingId(requisition._id);
      const res = await storesAPI.printIssueNote(requisition._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const win = window.open(url, '_blank');
      if (win) {
        win.addEventListener('load', () => win.print());
      } else {
        // Popup blocked — fall back to a download.
        const link = document.createElement('a');
        link.href = url;
        link.download = `${requisition.issueNoteNumber || 'issue-note'}.pdf`;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error: any) {
      showToast('Failed to open the issue note', 'error');
    } finally {
      setPrintingId(null);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { itemId: '', itemCode: '', description: '', quantity: 1, catalogItem: null }]
    });
  };

  const updateItem = (index: any, field: any, value: any) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Store Requisitions"
        subtitle={
          isStoresOfficer ? 'Process department stock requests' : 'Request items from stores'
        }
        actions={
          !isStoresOfficer ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="h-5 w-5" />
              Request from Store
            </button>
          ) : undefined
        }
      />

      {/* Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search requisitions..."
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
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
          <>
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
                {requisitions.map((req: any) => (
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
                        {isStoresOfficer && ['approved', 'partially_issued'].includes(req.status) && (
                          <button
                            onClick={() => {
                              setSelectedRequisition(req);
                              setCollectedBy({ name: '', idNumber: '', department: '', contactNumber: '' });
                              setShowIssueModal(true);
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark"
                          >
                            Issue Items
                          </button>
                        )}
                        {['partially_issued', 'issued'].includes(req.status) && (
                          <button
                            onClick={() => handlePrintIssueNote(req)}
                            disabled={printingId === req._id}
                            className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            {printingId === req._id ? 'Opening…' : 'Issue Note'}
                          </button>
                        )}
                      </div>
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
            itemLabel="requisitions"
          />
          </>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Request from Store"
      >
        <div className="space-y-4">
          {formData.items.map((item: any, index: any) => (
            <div key={index} className="bg-gray-50 rounded-xl p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Item</label>
                  {/* Picked from the stock catalogue so the line points at a real
                      inventory item. Free text still works for something not yet
                      carried, but then stores cannot match it against stock. */}
                  <ItemSelect
                    value={item.catalogItem || null}
                    freeTextValue={item.description}
                    onChange={(catalogItem) => {
                      const newItems = [...formData.items];
                      newItems[index] = {
                        ...newItems[index],
                        catalogItem,
                        itemId: catalogItem?._id || '',
                        itemCode: catalogItem?.code || '',
                        description: catalogItem?.name || newItems[index].description
                      };
                      setFormData({ ...formData, items: newItems });
                    }}
                    onFreeText={(text) => {
                      const newItems = [...formData.items];
                      newItems[index] = {
                        ...newItems[index],
                        catalogItem: null,
                        itemId: '',
                        itemCode: '',
                        description: text
                      };
                      setFormData({ ...formData, items: newItems });
                    }}
                    placeholder="Search stock catalog or type description…"
                    className="w-full"
                  />
                  {item.catalogItem ? (
                    <p className="text-xs text-emerald-600 mt-1">
                      Linked to catalog · {item.catalogItem.quantityAvailable} available at your site
                    </p>
                  ) : (
                    item.description?.trim() && (
                      <p className="text-xs text-amber-600 mt-1">
                        Not linked to a catalog item — stores will have to match this by hand.
                      </p>
                    )
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e: any) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
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
                    {selectedRequisition.items?.map((item: any, index: any) => (
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
              onChange={(e: any) => setActionComment(e.target.value)}
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
              onChange={(e: any) => setActionComment(e.target.value)}
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

      {/* Issue Modal — captures who carried the goods away */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => {
          setShowIssueModal(false);
          setCollectedBy({ name: '', idNumber: '', department: '', contactNumber: '' });
          setSelectedRequisition(null);
        }}
        title="Issue Stock"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Record who is collecting the goods. This prints on the issue note for them to sign,
            and is the record of who took the stock.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
              <input
                type="text"
                value={collectedBy.name}
                onChange={(e: any) => setCollectedBy((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Tapiwa Ncube"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ID / Employee no.</label>
              <input
                type="text"
                value={collectedBy.idNumber}
                onChange={(e: any) => setCollectedBy((prev) => ({ ...prev, idNumber: e.target.value }))}
                placeholder="Employee or national ID"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <input
                type="text"
                value={collectedBy.department}
                onChange={(e: any) => setCollectedBy((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="e.g. Workshop"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact number</label>
              <input
                type="text"
                value={collectedBy.contactNumber}
                onChange={(e: any) => setCollectedBy((prev) => ({ ...prev, contactNumber: e.target.value }))}
                placeholder="Phone number"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Leave blank only if nobody is available to sign — the issue note then prints an empty
            block to complete by hand.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setShowIssueModal(false);
                setCollectedBy({ name: '', idNumber: '', department: '', contactNumber: '' });
                setSelectedRequisition(null);
              }}
              disabled={actionLoading}
              className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleIssue}
              disabled={actionLoading}
              className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Issuing...
                </>
              ) : (
                'Issue Items'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

