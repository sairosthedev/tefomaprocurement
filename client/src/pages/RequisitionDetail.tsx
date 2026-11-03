import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { departmentAPI, procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { PR_CANCELLATION_REASONS, isProcurementHead } from '@fossil/shared';
import PageHeader from '../components/PageHeader';
import CancelWorkflowModal from '../components/CancelWorkflowModal';
import EquipmentDetailsView from '../components/EquipmentDetailsView';
import { canCancelRequisition, requisitionCancelApiBase } from '../lib/cancellationAccess';
import { CreateRFQDrawer } from '../components/RFQForm';
import { journeyStatus, journeySteps } from '../lib/requisitionJourney';
import { 
  FileText,
  CheckCircle,
  Ban,
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

const poStatusStyles: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  pending_dept_hod: { label: 'Awaiting department head', className: 'bg-purple-100 text-purple-700' },
  pending_hod: { label: 'Awaiting department head', className: 'bg-purple-100 text-purple-700' },
  pending_proc_hod: { label: 'Awaiting Head of Procurement', className: 'bg-fuchsia-100 text-fuchsia-700' },
  pending_finance: { label: 'Awaiting Finance', className: 'bg-amber-100 text-amber-700' },
  pending_coo: { label: 'Awaiting COO', className: 'bg-indigo-100 text-indigo-700' },
  pending_approvals: { label: 'Pending approvals', className: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  issued: { label: 'Issued to supplier', className: 'bg-blue-100 text-blue-700' },
  partially_received: { label: 'Partly received', className: 'bg-teal-100 text-teal-700' },
  completed: { label: 'Fully received', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' }
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

// "rfq_created" → "RFQ created", keeping the acronyms people actually say.
const HISTORY_LABELS: Record<string, string> = {
  hod_approved: 'Approved by department head',
  forwarded_to_procurement: 'Forwarded to procurement',
  rfq_created: 'RFQ created',
  po_created: 'PO created'
};
const historyLabel = (action?: string): string => {
  if (!action) return 'Updated';
  if (HISTORY_LABELS[action]) return HISTORY_LABELS[action];
  const text = action.replace(/_/g, ' ').replace(/\b(rfq|po|hod|grv)\b/gi, (m) => m.toUpperCase());
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  // The RFQ form opens over this page, so the officer keeps their place.
  const [creatingRfq, setCreatingRfq] = useState(false);

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
      setCreatingRfq(true);
      // Show the accepted status underneath, for when the form is closed unsent.
      fetchRequisition();
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

  // Straight to the new RFQ, where its next steps are.
  const handleRfqCreated = (rfqId?: string) => {
    setCreatingRfq(false);
    if (rfqId) navigate(`/app/rfqs/${rfqId}`);
    else fetchRequisition();
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

  const stage = journeyStatus(requisition);
  const steps = journeySteps(requisition);
  const currentStep = steps.findIndex((s) => !s.done);
  const stopped = requisition.status === 'cancelled' || requisition.status === 'rejected';
  const po = requisition.purchaseOrder;
  const rfq = requisition.rfq;
  const items = requisition.items || [];
  const justification = requisition.justification || requisition.description;

  // Only the facts this requisition actually has; empty optional fields would
  // just be a row of dashes.
  const facts: Array<{ label: string; value: React.ReactNode; sub?: string }> = [
    { label: 'Raised', value: new Date(requisition.createdAt).toLocaleDateString('en-ZA') },
    {
      label: 'Requested by',
      value: requisition.requestedBy
        ? `${requisition.requestedBy.firstName} ${requisition.requestedBy.lastName}`
        : '—',
      sub: requisition.requestedBy?.email
    },
    { label: 'Department', value: requisition.department?.name || '—' },
    {
      label: 'Priority',
      value: (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[requisition.priority] || priorityColors.medium}`}>
          {requisition.priority || 'Medium'}
        </span>
      )
    },
    ...(requisition.requiredDate
      ? [{ label: 'Required by', value: new Date(requisition.requiredDate).toLocaleDateString('en-ZA') }]
      : []),
    ...(requisition.estimatedTotal > 0
      ? [{ label: 'Estimated value', value: formatCurrency(requisition.estimatedTotal, requisition.currency || getCurrentSbuCurrency()) }]
      : []),
    ...(requisition.workOrder ? [{ label: 'Work order', value: requisition.workOrder }] : []),
    ...(requisition.storesIssueNumber ? [{ label: 'Stores issue no.', value: requisition.storesIssueNumber }] : [])
  ];

  const th = 'py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap';

  return (
    <div className="p-6">
      <PageHeader
        backTo="/app/requisitions"
        backLabel="Back to Requisitions"
        bottomSpacing="mb-4"
        title={requisition.title || 'Requisition'}
        subtitle={`#${requisition.requisitionNumber || `REQ-${requisition._id?.slice(-6).toUpperCase()}`}`}
        actions={
          <>
            <span
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${stage.className}`}
              title={stage.hint || undefined}
            >
              {stage.label}
            </span>
            {isOwner && requisition.status === 'draft' && (
              <button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  (requisition.items || []).filter((item: any) => item.description?.trim()).length === 0
                }
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
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
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
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

      <CreateRFQDrawer
        isOpen={creatingRfq}
        requisitionId={requisition._id}
        onClose={() => setCreatingRfq(false)}
        onSaved={handleRfqCreated}
      />

      {requisition.status === 'cancelled' && requisition.cancellationReason && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Cancellation reason:</strong> {requisition.cancellationReason}
        </div>
      )}

      {/* Summary — the requisition's facts, then where it has got to */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-5">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8 gap-x-6 gap-y-3 px-5 py-4">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-gray-400">{fact.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-gray-900 truncate" title={typeof fact.value === 'string' ? fact.value : undefined}>
                {fact.value}
              </dd>
              {fact.sub && <dd className="text-xs text-gray-500 truncate" title={fact.sub}>{fact.sub}</dd>}
            </div>
          ))}
        </dl>

      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — what is being asked for, and how it is being bought */}
        <div className="lg:col-span-2 space-y-5">
          {items.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <h2 className="font-semibold text-gray-900">
                  Line items <span className="ml-1 text-sm font-normal text-gray-400">{items.length}</span>
                </h2>
                {canEditItems && (
                  <span className="text-xs text-gray-400">
                    Remove any item you don't want purchased before approving.
                  </span>
                )}
              </div>
              {justification && (
                <p className="px-5 pb-3 -mt-1 text-sm text-gray-600 leading-relaxed">
                  <span className="font-medium text-gray-800">Justification: </span>
                  {justification}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={`text-left ${th}`}>Package</th>
                      <th className={`text-left ${th}`}>Details</th>
                      <th className={`text-left ${th}`}>Units</th>
                      <th className={`text-right ${th}`}>Qty Req.</th>
                      <th className={`text-right ${th}`}>Qty Delivered</th>
                      {canEditItems && <th className={`text-right ${th}`}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, index: any) => (
                      <tr key={item._id || index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-600">{item.package || '—'}</td>
                        <td className="py-2 px-3 border-b border-gray-100">
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
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-600">{item.unit}</td>
                        <td className="py-2 px-3 border-b border-gray-100 text-right">
                          {canEditItems && editingItemId === item._id ? (
                            <div className="flex items-center justify-end gap-1.5">
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
                        <td className="py-2 px-3 border-b border-gray-100 text-right">
                          <p className="text-sm font-medium text-emerald-700">
                            {(item.quantityFulfilledFromStock ?? 0) > 0 ? item.quantityFulfilledFromStock : '—'}
                          </p>
                        </td>
                        {canEditItems && (
                          <td className="py-2 px-3 border-b border-gray-100 text-right">
                            <button
                              onClick={() => handleRemoveItem(item)}
                              disabled={removingItemId === item._id || items.length <= 1}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={items.length <= 1 ? 'At least one item is required' : 'Remove this item'}
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
            </section>
          )}

          {/* Sourcing, ordering and delivery, side by side */}
          {(rfq || po || requisition.itemsDeliveredToStores) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {po && (
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                      Purchase order
                    </h3>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      poStatusStyles[po.status]?.className || 'bg-gray-100 text-gray-700'
                    }`}>
                      {poStatusStyles[po.status]?.label || String(po.status).replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="font-mono font-semibold text-primary break-all">{po.poNumber}</p>
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-600 truncate">{po.supplier?.companyName || '—'}</span>
                    {typeof po.totalAmount === 'number' && (
                      <span className="font-semibold text-gray-900 shrink-0">
                        {formatCurrency(po.totalAmount, po.currency || getCurrentSbuCurrency())}
                      </span>
                    )}
                  </div>

                  {(SEQUENTIAL_PO_STATUSES.includes(po.status) || po.status === 'pending_approvals') && (() => {
                    const approvals = po.status === 'pending_approvals'
                      // Legacy POs: finance and COO in parallel.
                      ? [
                          { label: 'Finance', done: !!po.financeApproved },
                          { label: 'COO', done: !!po.cooApproved }
                        ]
                      : [
                          // New POs skip the department head; only older ones still wait on it.
                          ...(po.status === 'pending_hod' ? [{ label: 'Dept head', done: !!po.deptHodApproved }] : []),
                          { label: 'Head of Procurement', done: !!po.procHodApproved },
                          { label: 'Finance', done: !!po.financeApproved },
                          // The COO step applies only when the server flagged the PO
                          // (its USD limit converted at the stored FX rate).
                          ...(po.requiresCooApproval ? [{ label: 'COO', done: !!po.cooApproved }] : [])
                        ];
                    const waiting = approvals.find((a) => !a.done);
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-1.5">
                          {approvals.map((a) => (
                            <span
                              key={a.label}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                a.done
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : a === waiting
                                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                    : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {a.done ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {a.label}
                            </span>
                          ))}
                        </div>
                        {waiting && <p className="mt-1.5 text-xs text-amber-700">Awaiting {waiting.label}</p>}
                      </div>
                    );
                  })()}

                  {/* Requesters and department heads follow the order from this
                      panel; the PO pages themselves are procurement's. */}
                  {isProcurement && (
                    <Link
                      to={`/app/purchase-orders/${po._id}`}
                      className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      View purchase order →
                    </Link>
                  )}
                </section>
              )}

              {requisition.itemsDeliveredToStores && (
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                      <Truck className="h-4 w-4 text-emerald-600" />
                      Stores
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      {requisition.itemsCollected ? 'Collected' : 'Ready to collect'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {requisition.itemsCollected
                      ? 'The items have been collected from stores.'
                      : 'The ordered items have been received and are available in stores.'}
                    {!requisition.itemsCollected && !isDepartment && !isProcurement && ' Your department head requests them from stores.'}
                  </p>
                  {/* Store requisitions are raised by the department head. */}
                  {!requisition.itemsCollected && isDepartment && (
                    <button
                      onClick={() => navigate('/app/store-requisitions')}
                      className="mt-3 py-2 px-4 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors inline-flex items-center gap-2"
                    >
                      <Truck className="h-4 w-4" />
                      Request from Stores
                    </button>
                  )}
                </section>
              )}

              {rfq && (
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                      <FileText className="h-4 w-4 text-primary" />
                      RFQ
                    </h3>
                    {rfq.sourcing?.status && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {rfqStatusLabels[rfq.sourcing.status] || rfq.sourcing.status}
                      </span>
                    )}
                  </div>
                  {/* Only procurement can open the RFQ pages; everyone else
                      follows progress from the summary below. */}
                  {isProcurement ? (
                    <Link to={`/app/rfqs/${rfq._id}`} className="font-mono font-semibold text-primary hover:underline break-all">
                      {rfq.rfqNumber}
                    </Link>
                  ) : (
                    <p className="font-mono font-semibold text-primary break-all">{rfq.rfqNumber}</p>
                  )}
                  {(rfq.title || rfq.submissionDeadline) && (
                    <p className="mt-1 text-sm text-gray-600 truncate">
                      {[rfq.title, rfq.submissionDeadline && `Deadline ${new Date(rfq.submissionDeadline).toLocaleDateString('en-ZA')}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {(() => {
                    const sourcing = rfq.sourcing;
                    if (!sourcing) return null;
                    const lines = sourcing.lines;
                    const winner = sourcing.winner;
                    const progress: string[] = [
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
                      progress.push(`Winner: ${winner.supplierName || winner.quotationNumber || 'supplier'}`);
                      progress.push(
                        sourcing.authorized
                          ? 'Authorized by Head of Procurement'
                          : 'Awaiting Head of Procurement authorization'
                      );
                    } else if (sourcing.quotationCount > 0 && sourcing.status !== 'cancelled') {
                      progress.push('No winner selected yet');
                    }
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                        <p className="text-xs text-gray-700">{progress.join(' · ')}</p>
                        {winner?.justification && !lines && (
                          <p className="text-xs text-gray-500 italic">“{winner.justification}”</p>
                        )}
                        {isProcurement && !sourcing.sealed && (lines || winner) && (
                          <Link
                            to={lines ? `/app/rfqs/${rfq._id}/award` : `/app/quotations/${winner.quotationId}`}
                            className="inline-block text-xs font-medium text-primary hover:underline"
                          >
                            {lines ? 'Open award matrix →' : 'View selected quotation →'}
                          </Link>
                        )}
                      </div>
                    );
                  })()}
                </section>
              )}
            </div>
          )}
        </div>

        {/* Right — who signed it off, and what has happened */}
        <div className="space-y-5">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Sign-off</h3>
            {/* The paper IR's "Approved By" / "Authorised By" boxes */}
            <dl className="divide-y divide-gray-100">
              {[
                {
                  label: 'Approved by (HOD)',
                  person: requisition.hodApprovedBy,
                  at: requisition.hodApprovedAt,
                  empty: 'Pending'
                },
                {
                  label: 'Authorised by (Stores / Procurement)',
                  person: requisition.storesReviewedBy || requisition.processedBy,
                  at: requisition.storesReviewedBy ? requisition.storesReviewedAt : undefined,
                  empty: '—'
                }
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <dt className="text-xs text-gray-500 pt-0.5">{row.label}</dt>
                  <dd className="text-right">
                    {row.person ? (
                      <>
                        <p className="text-sm font-medium text-gray-900">{row.person.firstName} {row.person.lastName}</p>
                        {row.at && <p className="text-xs text-gray-400">{new Date(row.at).toLocaleDateString('en-ZA')}</p>}
                      </>
                    ) : (
                      <p className={`text-sm ${row.empty === 'Pending' ? 'text-amber-600' : 'text-gray-400'}`}>{row.empty}</p>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {requisition.statusHistory?.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Activity</h3>
              <ol className="relative">
                {requisition.statusHistory.map((history: any, index: number) => {
                  const last = index === requisition.statusHistory.length - 1;
                  const tone =
                    history.action === 'rejected' || history.action === 'cancelled'
                      ? 'bg-red-500'
                      : last
                        ? 'bg-primary'
                        : 'bg-emerald-500';
                  return (
                    <li key={index} className="relative pl-5 pb-3 last:pb-0">
                      {!last && <span className="absolute left-[4px] top-3 bottom-0 w-px bg-gray-200" />}
                      <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${tone}`} />
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{historyLabel(history.action)}</p>
                        <p className="text-[11px] text-gray-400 whitespace-nowrap">
                          {new Date(history.timestamp).toLocaleString('en-ZA', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {history.comments && (
                        <p className="text-xs text-gray-500 line-clamp-2" title={history.comments}>{history.comments}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
