import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { departmentAPI, procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/constants';
import { PR_CANCELLATION_REASONS, isProcurementHead } from '@fossil/shared';
import PageHeader from '../components/PageHeader';
import CancelWorkflowModal from '../components/CancelWorkflowModal';
import EquipmentDetailsView from '../components/EquipmentDetailsView';
import { canCancelRequisition, requisitionCancelApiBase } from '../lib/cancellationAccess';
import { WorkflowStepper, NextStepCard } from '../components/WorkflowStepper';
import { requisitionJourney } from '../lib/procurementJourney';
import { 
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ShoppingCart,
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

const poStatusStyles: Record<string, { label: string; className: string }> = {
  pending_dept_hod: { label: 'Awaiting department head', className: 'bg-purple-100 text-purple-700' },
  pending_hod: { label: 'Awaiting department head', className: 'bg-purple-100 text-purple-700' },
  pending_proc_hod: { label: 'Awaiting Head of Procurement', className: 'bg-fuchsia-100 text-fuchsia-700' },
  pending_finance: { label: 'Awaiting Finance', className: 'bg-amber-100 text-amber-700' },
  pending_coo: { label: 'Awaiting COO', className: 'bg-indigo-100 text-indigo-700' },
  pending_approvals: { label: '⏳ Pending Approvals', className: 'bg-blue-100 text-blue-700' },
  approved: { label: '✅ Approved', className: 'bg-green-100 text-green-700' },
  issued: { label: '📦 Issued', className: 'bg-blue-100 text-blue-700' },
  rejected: { label: '❌ Rejected', className: 'bg-red-100 text-red-700' }
};

const rfqStatusLabels: Record<string, string> = {
  draft: 'RFQ in draft',
  open: 'Open for quotes',
  closed: 'Closed for quotes',
  evaluating: 'Under evaluation',
  awarded: 'Awarded',
  cancelled: 'RFQ cancelled'
};

// The current chain, one approver after another. Legacy pending_approvals POs
// (finance and COO in parallel) keep their own progress panel below.
const SEQUENTIAL_PO_STATUSES = ['pending_dept_hod', 'pending_hod', 'pending_proc_hod', 'pending_finance', 'pending_coo'];

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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // The Head of Procurement reads requisitions through the procurement
  // endpoint like an officer; on their own department's requisitions they
  // also keep the department head's controls.
  const procHead = isProcurementHead(user);
  const isProcurement = user?.role === 'procurement_officer' || procHead;
  const ownDeptId = String(user?.department?._id || user?.department || '');
  const isOwnDept =
    !!ownDeptId && String(requisition?.department?._id || requisition?.department || '') === ownDeptId;
  const isDepartment = user?.role === 'department_head' && (!procHead || isOwnDept);
  // Submitting is the requester's own step; the API refuses anyone else.
  const userId = String(user?._id || user?.id || '');
  const isOwner =
    !!userId && String(requisition?.requestedBy?._id || requisition?.requestedBy || '') === userId;
  const mayCancelRequisition = canCancelRequisition(user, requisition);
  const [accepting, setAccepting] = useState(false);

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

  // Accepting is only ever followed by sourcing, so the RFQ form opens next
  // with this requisition already chosen.
  const handleAccept = async () => {
    try {
      setAccepting(true);
      await api.put(`/procurement/requisitions/${id}/accept`, { comments: '' });
      showToast('Requisition accepted — now create its RFQ', 'success');
      navigate(`/app/rfqs/create?requisition=${id}`);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to accept requisition', 'error');
    } finally {
      setAccepting(false);
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

  const handleCancelRequisition = async ({
    reasonCode,
    comments
  }: {
    reasonCode: string;
    comments?: string;
  }) => {
    try {
      setCancelling(true);
      const base = requisitionCancelApiBase(user, requisition?.status);
      const payload = { reasonCode, comments };
      if (base === '/procurement') {
        await procurementAPI.cancelRequisition(id, payload);
      } else {
        await departmentAPI.cancelRequisition(id, payload);
      }
      showToast('Requisition cancelled', 'success');
      fetchRequisition();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to cancel requisition', 'error');
      throw error;
    } finally {
      setCancelling(false);
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
      <PageHeader
        backTo="/app/requisitions"
        backLabel="Back to Requisitions"
        bottomSpacing="mb-4"
        title={requisition.title || 'Requisition'}
        subtitle={`#${requisition.requisitionNumber || `REQ-${requisition._id?.slice(-6).toUpperCase()}`}`}
        actions={
          <>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[requisition.status]}`}>
              {statusLabels[requisition.status] || requisition.status?.replace(/_/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase())}
            </span>
            {isOwner && requisition.status === 'draft' && (
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
            {mayCancelRequisition && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                disabled={cancelling}
                className="px-4 py-2.5 border border-red-200 text-red-700 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Cancel requisition
              </button>
            )}
          </>
        }
      />

      <CancelWorkflowModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel requisition"
        description="Open RFQs and draft purchase orders linked to this requisition will also be cancelled. This cannot be undone."
        reasons={PR_CANCELLATION_REASONS}
        onConfirm={handleCancelRequisition}
      />

      {(() => {
        const { steps, next } = requisitionJourney(requisition, {
          isOwner,
          isDepartment,
          isProcurement,
          isProcurementHead: procHead,
          isStores: user?.role === 'stores_officer'
        });
        const key = next?.action?.key;
        return (
          <>
            <WorkflowStepper steps={steps} />
            {/* A plain "Waiting on" note repeats what the stepper already shows; keep the card only when it has a button. */}
            {next && (!next.waiting || next.action) && (
              <NextStepCard
                title={next.title}
                description={next.description}
                waiting={next.waiting}
                action={
                  next.action && {
                    label: key === 'accept' && accepting ? 'Accepting...' : next.action.label,
                    to: next.action.to,
                    onClick: key === 'submit' ? handleSubmit : key === 'accept' ? handleAccept : undefined,
                    disabled: key === 'submit' ? submitting : key === 'accept' ? accepting : undefined
                  }
                }
              />
            )}
          </>
        );
      })()}

      {requisition.status === 'cancelled' && requisition.cancellationReason && (
        <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Cancellation reason:</strong> {requisition.cancellationReason}
        </div>
      )}

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
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Package</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Details</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Units</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Qty Req.</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Qty Delivered</th>
                      {canEditItems && (
                        <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {requisition.items.map((item: any, index: any) => (
                      <tr key={item._id || index} className="hover:bg-gray-50">
                        <td className="py-2 px-3 border border-gray-200 text-gray-600">{item.package || '—'}</td>
                        <td className="py-2 px-3 border border-gray-200">
                          <p className="font-medium text-gray-900">{item.description || item.name}</p>
                          {(item.specification || item.specifications) && (
                            <p className="text-xs text-gray-400 mt-0.5">{item.specification || item.specifications}</p>
                          )}
                          <EquipmentDetailsView
                            equipment={item.equipment}
                            attachments={item.attachments}
                            compact
                          />
                        </td>
                        <td className="py-2 px-3 border border-gray-200 text-gray-600">{item.unit}</td>
                        <td className="py-2 px-3 border border-gray-200 text-right">
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
                        <td className="py-2 px-3 border border-gray-200 text-right">
                          <p className="text-sm font-medium text-emerald-700">
                            {(item.quantityFulfilledFromStock ?? 0) > 0 ? item.quantityFulfilledFromStock : '—'}
                          </p>
                        </td>
                        {canEditItems && (
                          <td className="py-2 px-3 border border-gray-200 text-right">
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
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Status History</h2>
              {/* One line per entry so the history doesn't push the page into scrolling. */}
              <div className="divide-y divide-gray-100">
                {requisition.statusHistory.map((history: any, index: any) => (
                  <div key={index} className="flex items-center gap-3 py-2">
                    {history.action === 'accepted' ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                    ) : history.action === 'rejected' ? (
                      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <p className="text-sm font-medium capitalize text-gray-900 whitespace-nowrap">
                      {String(history.action || '').replace(/_/g, ' ')}
                    </p>
                    <p className="flex-1 min-w-0 truncate text-xs text-gray-500" title={history.comments}>
                      {history.comments}
                    </p>
                    <p className="text-xs text-gray-400 whitespace-nowrap">
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
            {/* IR header fields — mirrors the paper Internal Requisition form */}
            <dl className="space-y-2.5 text-sm pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500">Date</dt>
                <dd className="font-medium text-gray-900 text-right">
                  {new Date(requisition.createdAt).toLocaleDateString('en-ZA')}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500">Requested by</dt>
                <dd className="font-medium text-gray-900 text-right min-w-0">
                  {requisition.requestedBy
                    ? `${requisition.requestedBy.firstName} ${requisition.requestedBy.lastName}`
                    : '—'}
                  {requisition.requestedBy?.email && (
                    <span className="block text-xs font-normal text-gray-500 break-all">{requisition.requestedBy.email}</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500">Department</dt>
                <dd className="font-medium text-gray-900 text-right">{requisition.department?.name || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500">Priority</dt>
                <dd>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[requisition.priority] || priorityColors.medium}`}>
                    {requisition.priority || 'Medium'}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500">Work order</dt>
                <dd className="font-medium text-gray-900 text-right">{requisition.workOrder || '—'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500">Stores issue no.</dt>
                <dd className="font-medium text-gray-900 text-right">{requisition.storesIssueNumber || '—'}</dd>
              </div>
            </dl>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Purchase Order</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono font-bold text-primary text-lg break-all">
                    {requisition.purchaseOrder.poNumber}
                  </p>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
                    poStatusStyles[requisition.purchaseOrder.status]?.className || 'bg-amber-100 text-amber-700'
                  }`}>
                    {poStatusStyles[requisition.purchaseOrder.status]?.label || requisition.purchaseOrder.status}
                  </span>
                </div>
                {SEQUENTIAL_PO_STATUSES.includes(requisition.purchaseOrder.status) && (() => {
                  const po = requisition.purchaseOrder;
                  const steps = [
                    // New POs skip the department head; only older ones still wait on it.
                    ...(po.status === 'pending_hod'
                      ? [{ label: 'Department head', done: !!po.deptHodApproved }]
                      : []),
                    { label: 'Head of Procurement', done: !!po.procHodApproved },
                    { label: 'Finance', done: !!po.financeApproved },
                    // The COO step applies only when the server flagged the PO
                    // (its USD limit converted at the stored FX rate).
                    ...(po.requiresCooApproval
                      ? [{ label: 'COO', done: !!po.cooApproved }]
                      : [])
                  ];
                  const current = steps.find((s) => !s.done);
                  return (
                    <div className="bg-white rounded-lg p-3 border border-blue-100 space-y-2">
                      <p className="text-xs font-medium text-gray-700">Approval Progress:</p>
                      {steps.map((step) => (
                        <div key={step.label} className="flex items-center justify-between">
                          <span className={`text-xs ${step === current ? 'font-medium text-amber-700' : 'text-gray-700'}`}>
                            {step.label}
                          </span>
                          {step.done ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className={`h-4 w-4 ${step === current ? 'text-amber-600' : 'text-gray-300'}`} />
                          )}
                        </div>
                      ))}
                      {current && (
                        <p className="text-xs text-amber-700 italic pt-1">Awaiting {current.label}</p>
                      )}
                    </div>
                  );
                })()}
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
                {/* Requesters and department heads follow the order from this
                    panel; the PO pages themselves are procurement's. */}
                {isProcurement && (
                  <a
                    href={`/app/purchase-orders/${requisition.purchaseOrder._id}`}
                    className="block w-full text-center py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    View Purchase Order
                  </a>
                )}
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
                    {!isDepartment && !isProcurement && ' Your department head requests them from stores.'}
                  </p>
                  {/* Store requisitions are raised by the department head. */}
                  {isDepartment && (
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

          {/* RFQ Info */}
          {requisition.rfq && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-gray-900">Related RFQ</h3>
              </div>
              <div className="space-y-2">
                {/* Only procurement can open the RFQ pages; everyone else
                    follows progress from the summary below. */}
                {isProcurement ? (
                  <Link
                    to={`/app/rfqs/${requisition.rfq._id}`}
                    className="font-mono font-medium text-primary text-sm hover:underline"
                  >
                    {requisition.rfq.rfqNumber}
                  </Link>
                ) : (
                  <p className="font-mono font-medium text-primary text-sm">
                    {requisition.rfq.rfqNumber}
                  </p>
                )}
                {requisition.rfq.title && (
                  <p className="text-xs text-gray-600">{requisition.rfq.title}</p>
                )}
                {requisition.rfq.submissionDeadline && (
                  <p className="text-xs text-gray-500 mt-1">
                    Deadline: {new Date(requisition.rfq.submissionDeadline).toLocaleDateString()}
                  </p>
                )}
                {(() => {
                  const sourcing = requisition.rfq.sourcing;
                  if (!sourcing) return null;
                  const lines = sourcing.lines;
                  const winner = sourcing.winner;
                  const progress: string[] = [
                    rfqStatusLabels[sourcing.status] || sourcing.status,
                    `${sourcing.quotationCount} ${sourcing.quotationCount === 1 ? 'quote' : 'quotes'} received`
                  ];
                  if (sourcing.sealed) {
                    progress.push('Bids stay sealed until the RFQ closes');
                  } else if (lines) {
                    progress.push(`${lines.awarded} of ${lines.total} lines awarded`);
                    if (lines.awaitingAuthorization > 0) {
                      progress.push(`${lines.awaitingAuthorization} awaiting Head of Procurement authorization`);
                    }
                    if (lines.authorized > 0) progress.push(`${lines.authorized} authorized`);
                    if (lines.poGenerated > 0) progress.push(`${lines.poGenerated} on purchase orders`);
                  } else if (winner) {
                    progress.push(`Winner selected: ${winner.supplierName || winner.quotationNumber || 'supplier'}`);
                    progress.push(
                      sourcing.authorized
                        ? 'Authorized by Head of Procurement'
                        : 'Awaiting Head of Procurement authorization'
                    );
                  } else if (sourcing.quotationCount > 0 && sourcing.status !== 'cancelled') {
                    progress.push('No winner selected yet');
                  }
                  return (
                    <div className="pt-2 mt-2 border-t border-gray-100 space-y-1.5">
                      <p className="text-xs text-gray-700">{progress.join(' · ')}</p>
                      {winner?.justification && !lines && (
                        <p className="text-xs text-gray-500 italic">“{winner.justification}”</p>
                      )}
                      {isProcurement && !sourcing.sealed && (lines || winner) && (
                        <Link
                          to={lines ? `/app/rfqs/${requisition.rfq._id}/award` : `/app/quotations/${winner.quotationId}`}
                          className="inline-block text-xs font-medium text-primary hover:underline"
                        >
                          {lines ? 'Open award matrix' : 'View selected quotation'}
                        </Link>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
