import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { departmentAPI, procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/constants';
import PageHeader from '../components/PageHeader';
import { 
  FileText, 
  Calendar, 
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ShoppingCart,
  User,
  Send,
  Truck,
  Trash2,
  Pencil,
  Check,
  X
} from 'lucide-react';

const statusColors: any = {
  draft: 'bg-gray-100 text-gray-700',
  pending_hod: 'bg-amber-100 text-amber-700',
  stores_review: 'bg-cyan-100 text-cyan-700',
  fulfilled: 'bg-emerald-100 text-emerald-700',
  pending_acceptance: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  sourcing: 'bg-blue-100 text-blue-700',
  quoted: 'bg-indigo-100 text-indigo-700',
  ordered: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500'
};

const statusLabels: any = {
  draft: 'Draft',
  pending_hod: 'Pending HOD Approval',
  stores_review: 'Stores Review',
  fulfilled: 'Fulfilled from Stock',
  pending_acceptance: 'Pending Acceptance',
  accepted: 'Accepted',
  rejected: 'Rejected',
  sourcing: 'Sourcing',
  quoted: 'Quoted',
  ordered: 'Ordered',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

const priorityColors: any = {
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
  const [loading, setLoading] = useState<any>(true);
  const [requisition, setRequisition] = useState<any>(null);
  const [submitting, setSubmitting] = useState<any>(false);
  const [removingItemId, setRemovingItemId] = useState<any>(null);
  const [editingItemId, setEditingItemId] = useState<any>(null);
  const [editQty, setEditQty] = useState<any>('');
  const [savingQty, setSavingQty] = useState<any>(false);

  const isProcurement = user?.role === 'procurement_officer' || user?.role === 'admin';
  const isDepartment = user?.role === 'department_head' || user?.role === 'admin';

  // An approver may drop line items they don't want purchased before approving.
  const canEditItems =
    requisition &&
    ((requisition.status === 'pending_hod' && isDepartment) ||
      (requisition.status === 'pending_acceptance' && isProcurement));

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
    } catch (error: any) {
      console.error('Error fetching requisition:', error);
      showToast(error.response?.data?.message || 'Failed to load requisition details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const enteredItems = (requisition?.items || []).filter((item: any) => item.description?.trim());
    if (enteredItems.length === 0) {
      showToast('At least one item is required before submitting', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await departmentAPI.submitRequisition(id);
      showToast('Requisition submitted successfully', 'success');
      fetchRequisition();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to submit requisition', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveItem = async (item: any) => {
    if (!requisition) return;
    if ((requisition.items?.length || 0) <= 1) {
      showToast('Cannot remove the last item. Reject the requisition instead if nothing is needed.', 'error');
      return;
    }
    const label = item.description || item.name || 'this item';
    if (!window.confirm(`Remove "${label}" from this requisition? It will not be purchased.`)) {
      return;
    }

    try {
      setRemovingItemId(item._id);
      // pending_acceptance is owned by procurement; everything else routes via department.
      const base = requisition.status === 'pending_acceptance' ? '/procurement' : '/department';
      const response = await api.delete(`${base}/requisitions/${requisition._id}/items/${item._id}`);
      if (response.data.success) {
        showToast(response.data.message || 'Item removed', 'success');
        fetchRequisition();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to remove item', 'error');
    } finally {
      setRemovingItemId(null);
    }
  };

  const startEditQty = (item: any) => {
    setEditingItemId(item._id);
    setEditQty(String(item.quantity ?? ''));
  };

  const cancelEditQty = () => {
    setEditingItemId(null);
    setEditQty('');
  };

  const handleSaveQty = async (item: any) => {
    if (!requisition) return;
    const qty = Number(editQty);
    if (!Number.isFinite(qty) || qty < 1) {
      showToast('Quantity must be a whole number of at least 1.', 'error');
      return;
    }
    if (Math.floor(qty) === item.quantity) {
      cancelEditQty();
      return;
    }

    try {
      setSavingQty(true);
      const base = requisition.status === 'pending_acceptance' ? '/procurement' : '/department';
      const response = await api.patch(`${base}/requisitions/${requisition._id}/items/${item._id}`, {
        quantity: Math.floor(qty)
      });
      if (response.data.success) {
        showToast(response.data.message || 'Quantity updated', 'success');
        cancelEditQty();
        fetchRequisition();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update quantity', 'error');
    } finally {
      setSavingQty(false);
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
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        backTo="/app/requisitions"
        backLabel="Back to Requisitions"
        title={requisition.title || 'Requisition'}
        subtitle={`#${requisition.requisitionNumber || `REQ-${requisition._id?.slice(-6).toUpperCase()}`}`}
        actions={
          <>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[requisition.status]}`}>
              {statusLabels[requisition.status] || requisition.status?.replace(/_/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase())}
            </span>
            {isDepartment && requisition.status === 'draft' && (
              <button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  (requisition.items || []).filter((item: any) => item.description?.trim()).length === 0
                }
                className="px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
                title={
                  (requisition.items || []).filter((item: any) => item.description?.trim()).length === 0
                    ? 'Add at least one item before submitting'
                    : undefined
                }
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit
              </button>
            )}
          </>
        }
      />

      {/* IR header — mirrors paper Internal Requisition form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Date</p>
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(requisition.createdAt).toLocaleDateString('en-ZA')}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Work Order</p>
            <p className="text-sm font-semibold text-gray-900">{requisition.workOrder || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Stores Issue No.</p>
            <p className="text-sm font-semibold text-gray-900">{requisition.storesIssueNumber || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Requested By</p>
            <p className="text-sm font-semibold text-gray-900">
              {requisition.requestedBy?.firstName} {requisition.requestedBy?.lastName}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Dept</p>
            <p className="text-sm font-semibold text-gray-900">{requisition.department?.name || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Priority</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[requisition.priority] || priorityColors.medium}`}>
              {requisition.priority || 'Medium'}
            </span>
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Justification</h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                {requisition.justification || requisition.description || 'No justification provided'}
              </p>
            </div>
          )}

          {/* Items */}
          {requisition.items && requisition.items.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
                {canEditItems && (
                  <span className="text-xs text-gray-400">
                    Remove any item you don't want purchased before approving.
                  </span>
                )}
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Package</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Details</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Units</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600">Qty Req.</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600">Qty Delivered</th>
                      {canEditItems && (
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requisition.items.map((item: any, index: any) => (
                      <tr key={item._id || index}>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.package || '—'}</td>
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-gray-900">{item.description || item.name}</p>
                          {(item.specification || item.specifications) && (
                            <p className="text-xs text-gray-400 mt-0.5">{item.specification || item.specifications}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.unit}</td>
                        <td className="py-3 px-4 text-right">
                          {canEditItems && editingItemId === item._id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                autoFocus
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveQty(item);
                                  if (e.key === 'Escape') cancelEditQty();
                                }}
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary"
                              />
                              <span className="text-xs text-gray-500">{item.unit}</span>
                              <button
                                onClick={() => handleSaveQty(item)}
                                disabled={savingQty}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                                title="Save"
                              >
                                {savingQty ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={cancelEditQty}
                                disabled={savingQty}
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <p className="text-sm text-gray-900">{item.quantity}</p>
                              {canEditItems && (
                                <button
                                  onClick={() => startEditQty(item)}
                                  className="p-1 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                                  title="Edit quantity"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <p className="text-sm font-medium text-emerald-700">
                            {(item.quantityFulfilledFromStock ?? 0) > 0 ? item.quantityFulfilledFromStock : '—'}
                          </p>
                        </td>
                        {canEditItems && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRemoveItem(item)}
                              disabled={removingItemId === item._id || requisition.items.length <= 1}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={requisition.items.length <= 1 ? 'At least one item is required' : 'Remove this item'}
                            >
                              {removingItemId === item._id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Remove
                            </button>
                          </td>
                        )}
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
                {requisition.statusHistory.map((history: any, index: any) => (
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
          {/* Approvals — paper IR "Approved By" / "Authorised By" */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Approvals</h3>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-gray-50">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Approved By (HOD)</p>
                {requisition.hodApprovedBy ? (
                  <>
                    <p className="text-sm font-medium text-gray-900">
                      {requisition.hodApprovedBy.firstName} {requisition.hodApprovedBy.lastName}
                    </p>
                    {requisition.hodApprovedAt && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(requisition.hodApprovedAt).toLocaleDateString('en-ZA')}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-amber-600">Pending</p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Authorised By (Stores / Procurement)</p>
                {requisition.storesReviewedBy ? (
                  <>
                    <p className="text-sm font-medium text-gray-900">
                      {requisition.storesReviewedBy.firstName} {requisition.storesReviewedBy.lastName}
                    </p>
                    {requisition.storesReviewedAt && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(requisition.storesReviewedAt).toLocaleDateString('en-ZA')}
                      </p>
                    )}
                  </>
                ) : requisition.processedBy ? (
                  <p className="text-sm font-medium text-gray-900">
                    {requisition.processedBy.firstName} {requisition.processedBy.lastName}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">—</p>
                )}
              </div>
            </div>
          </div>

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
