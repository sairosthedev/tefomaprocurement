import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api, { departmentAPI } from '../lib/api';
import FilterSelect from '../components/FilterSelect';
import PageHeader from '../components/PageHeader';
import { Plus, Search, Send, Package, Loader2, Truck } from 'lucide-react';
import ViewButton from '../components/ViewButton';
import Modal, { ModalFooter } from '../components/Modal';
import Drawer from '../components/Drawer';
import RequisitionForm, { type RequisitionFormHandle } from '../components/RequisitionForm';
import { CreateRFQDrawer } from '../components/RFQForm';
import Pagination from '../components/Pagination';
import TableSkeleton from '../components/TableSkeleton';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import {
  journeyStatus,
  REQUISITION_STATUS_COLORS as statusColors,
  REQUISITION_STATUS_LABELS as statusLabels
} from '../lib/requisitionJourney';
import { isProcurementHead } from '@fossil/shared';

const priorityColors: any = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600'
};

export default function Requisitions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [searchTerm, setSearchTerm] = useState<any>('');
  const [statusFilter, setStatusFilter] = useState<any>('');
  const [selectedRequisition, setSelectedRequisition] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState<any>(false);
  const [actionType, setActionType] = useState<any>(''); // 'accept' or 'reject'
  const [actionComment, setActionComment] = useState<any>('');
  // Set when the server refuses an approval for want of budget; holds the
  // figures to show the approver so the decision is an informed one.
  const [budgetWarning, setBudgetWarning] = useState<any>(null);
  const [budgetOverrideReason, setBudgetOverrideReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<any>(false);
  const [submittingId, setSubmittingId] = useState<any>(null);
  const [storeRequestedIds, setStoreRequestedIds] = useState<Set<string>>(new Set());
  const [removingItemId, setRemovingItemId] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  // The create drawer lives in the URL (?new=1), so links from elsewhere can
  // open it and the browser's Back button closes it.
  const [searchParams, setSearchParams] = useSearchParams();
  const createFormRef = useRef<RequisitionFormHandle>(null);
  // The accepted requisition the RFQ drawer is open on, if any.
  const [rfqFor, setRfqFor] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'mine' | 'team'>('all');

  // The Head of Procurement works the procurement list. It also carries their
  // own department's requisitions at every stage (the API adds them), and on
  // those they keep the department head's actions: edit/submit drafts and the
  // pending_hod approval.
  const procHead = isProcurementHead(user);
  const isProcurement = user?.role === 'procurement_officer' || procHead;
  const isDeptHead = user?.role === 'department_head';
  const userId = String(user?._id || user?.id || '');
  // Only the requester submits a draft; the API refuses anyone else.
  const isOwner = (req: any) => !!userId && String(req?.requestedBy?._id || req?.requestedBy || '') === userId;
  // The department list sends a count; the procurement list still sends items.
  const itemCountOf = (req: any): number => req?.itemCount ?? req?.items?.length ?? 0;
  const ownDeptId = String(user?.department?._id || user?.department || '');
  const isOwnDept = (req: any) =>
    procHead && !!ownDeptId && String(req?.department?._id || req?.department || '') === ownDeptId;
  // Department-side actions: everyone outside procurement, plus the Head of
  // Procurement on their own department's requisitions.
  const actsAsDepartment = (req: any) => !isProcurement || isOwnDept(req);
  const canCreate = !isProcurement || procHead;
  // A department head's list mixes their own requisitions with their team's,
  // so say whose each one is.
  const showRequester = isProcurement || isDeptHead;
  const createOpen = canCreate && searchParams.get('new') === '1';

  const openCreate = () => {
    setSearchParams((params) => {
      params.set('new', '1');
      return params;
    });
  };

  const closeCreate = () => {
    setSearchParams(
      (params) => {
        params.delete('new');
        return params;
      },
      { replace: true }
    );
  };

  const handleCreated = () => {
    closeCreate();
    // Newest first, so the new requisition is on page one.
    if (page !== 1) setPage(1);
    else fetchRequisitions();
  };

  // Straight to the new RFQ, where its next steps are.
  const handleRfqCreated = (rfqId?: string) => {
    setRfqFor(null);
    if (rfqId) navigate(`/app/rfqs/${rfqId}`);
    else fetchRequisitions();
  };

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, viewFilter]);

  useEffect(() => {
    fetchRequisitions();
  }, [page, limit, searchTerm, statusFilter, isProcurement, viewFilter]);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      // Use different endpoint based on role
      const endpoint = isProcurement ? '/procurement/requisitions' : '/department/requisitions';
      const response = await api.get(endpoint, {
        params: {
          search: searchTerm,
          status: statusFilter || undefined,
          page,
          limit,
          ...(!isProcurement && isDeptHead ? { view: viewFilter } : {})
        }
      });
      if (response.data.success) {
        setRequisitions(response.data.data || []);
        setPagination(parsePagination(response.data.pagination));
      }
    } catch (error: any) {
      console.error('Failed to fetch requisitions:', error);
      showToast('Failed to load requisitions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (id: any, requisition?: any) => {
    if (itemCountOf(requisition) === 0) {
      showToast('At least one item is required before submitting', 'error');
      return;
    }

    try {
      setSubmittingId(id);
      await api.put(`/department/requisitions/${id}/submit`);
      showToast('Requisition submitted for Department Head approval', 'success');
      fetchRequisitions();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to submit', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleRequestFromStores = async (requisition: any) => {
    if (!requisition || !requisition.purchaseOrder) {
      showToast('Purchase order information not available', 'error');
      return;
    }

    try {
      // The list leaves out PO line items, so load them from the requisition.
      let poItems = requisition.purchaseOrder.items;
      if (!poItems) {
        const detail = await api.get(`/department/requisitions/${requisition._id}`);
        poItems = detail.data?.data?.purchaseOrder?.items || [];
      }

      // Create a store requisition for the items that HAVE been delivered/received
      const items = poItems.map((poItem: any) => ({
        description: poItem.description,
        quantity: poItem.quantityReceived || 0,
        unit: poItem.unit || 'Each'
      })).filter((item: any) => item.quantity > 0);

      if (items.length === 0) {
        showToast('No items have been delivered yet. Please wait for delivery confirmation.', 'info');
        return;
      }

      await departmentAPI.createStoreRequisition({
        purpose: `Request delivered items from Purchase Order ${requisition.purchaseOrder.poNumber} for Requisition ${requisition.requisitionNumber}`,
        items: items,
        priority: requisition.priority || 'medium'
      });

      showToast('Store requisition created successfully', 'success');
      setStoreRequestedIds((prev) => new Set(prev).add(requisition._id));
      fetchRequisitions();
    } catch (error: any) {
      console.error('Error creating store requisition:', error);
      showToast(error.response?.data?.message || 'Failed to create store requisition', 'error');
    }
  };

  const handleAction = async () => {
    const isReject = actionType === 'reject' || actionType === 'hod_reject';
    if (isReject && !actionComment.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }

    try {
      setActionLoading(true);
      // HOD approval gate uses the department endpoints; procurement uses its own
      const endpointMap: any = {
        approve: `/department/requisitions/${selectedRequisition._id}/approve`,
        hod_reject: `/department/requisitions/${selectedRequisition._id}/reject`,
        accept: `/procurement/requisitions/${selectedRequisition._id}/accept`,
        reject: `/procurement/requisitions/${selectedRequisition._id}/reject`
      };
      const endpoint = endpointMap[actionType];
      await api.put(endpoint, {
        comments: actionComment,
        reason: actionComment,
        // Empty unless the approver has confirmed an over-budget approval in
        // the prompt below; the server refuses without it.
        budgetOverrideReason: budgetOverrideReason.trim() || undefined
      });
      showToast(
        actionType === 'approve' ? 'Requisition approved and sent to stores'
          : actionType === 'accept' ? 'Requisition accepted — now create its RFQ'
          : 'Requisition rejected',
        'success'
      );
      setShowActionModal(false);
      if (actionType === 'accept') {
        // Accepting is only ever followed by sourcing, so the RFQ form opens
        // next with the requisition already chosen.
        setRfqFor(selectedRequisition._id);
      }
      setActionComment('');
      setBudgetOverrideReason('');
      setBudgetWarning(null);
      fetchRequisitions();
    } catch (error: any) {
      // The server refuses an over-budget approval until a reason is given.
      // Show what the overrun is and ask for one, rather than a bare error.
      if (error.response?.status === 409 && error.response?.data?.requiresBudgetOverride) {
        setBudgetWarning(error.response.data.budgetCheck || null);
        showToast('This requisition is over budget. A reason is required to approve it.', 'error');
        return;
      }
      showToast(error.response?.data?.message || `Failed to ${actionType}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openActionModal = (req: any, type: any) => {
    setSelectedRequisition(req);
    setActionType(type);
    setActionComment('');
    setBudgetOverrideReason('');
    // Show the position recorded at submission straight away, so an over-budget
    // request is visible before the approver clicks rather than after.
    setBudgetWarning(
      type === 'approve' && req?.budgetCheck?.exceedsBudget ? req.budgetCheck : null
    );
    setShowActionModal(true);
  };

  return (
    <div className="p-8">
      <PageHeader
        title={isProcurement ? 'Purchase Requisitions' : isDeptHead ? 'Department Requisitions' : 'My Requisitions'}
        subtitle={
          isProcurement
            ? 'Accept or reject requisitions from departments'
            : isDeptHead
              ? 'Requisitions you raised, and the ones your team raised for your approval'
              : 'Track your purchase requests'
        }
        bottomSpacing="mb-4"
      />

      {/* Filters */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {canCreate && (
            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              New Requisition
            </button>
          )}
          {/* Pushed to the right edge, with or without the button beside it. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:ml-auto">
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search requisitions..."
                value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            {/* HOD view: their own requisitions, their team's, or both */}
            {isDeptHead && !isProcurement && (
              <FilterSelect
                label="Show"
                size="sm"
                options={[
                  { value: '', label: 'All' },
                  { value: 'mine', label: 'Raised by me' },
                  { value: 'team', label: 'Raised by my team' }
                ]}
                value={viewFilter === 'all' ? '' : viewFilter}
                onChange={(v) => setViewFilter((v || 'all') as 'all' | 'mine' | 'team')}
              />
            )}
            <FilterSelect
              label="Status"
              size="sm"
              options={[
                { value: '', label: 'All' },
                ...(!isProcurement || procHead ? [{ value: 'draft', label: 'Draft' }] : []),
                ...(procHead ? [{ value: 'pending_hod', label: 'Pending HOD Approval' }] : []),
                { value: 'pending_acceptance', label: 'Pending Acceptance' },
                { value: 'accepted', label: 'Accepted' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'sourcing', label: 'Sourcing' },
                { value: 'quoted', label: 'Quoted' },
                { value: 'ordered', label: 'Ordered' },
                { value: 'completed', label: 'Completed' }
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
        </div>
      </div>

      {/* Requisitions List */}
      <div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Requisition</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Title</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap"></th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton cols={4} />
              ) : requisitions.length === 0 ? (
                <tbody><tr><td colSpan={4} className="text-center py-12 text-gray-500">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p>{isProcurement ? 'No requisitions to process' : 'No requisitions found'}</p>
                  {!isProcurement && (
                    <button onClick={openCreate} className="mt-4 text-primary font-medium hover:underline">
                      Create your first requisition
                    </button>
                  )}
                </td></tr></tbody>
              ) : (
              <tbody>
                {requisitions.map((req: any) => (
                  <tr key={req._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                    <td className="py-2.5 px-3 border-b border-gray-100 whitespace-nowrap align-top">
                      <span className="font-mono text-sm font-medium text-primary">
                        {req.requisitionNumber || `REQ-${req._id.slice(-6).toUpperCase()}`}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(req.createdAt).toLocaleDateString('en-ZA')}</p>
                    </td>
                    <td className="py-2.5 px-3 border-b border-gray-100 align-top">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-[18rem]" title={req.title || 'Untitled'}>
                          {req.title || 'Untitled'}
                        </p>
                        {/* Only priorities that change what someone does next earn a chip. */}
                        {(req.priority === 'high' || req.priority === 'urgent') && (
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${priorityColors[req.priority]}`}>
                            {req.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[22rem]">
                        {[
                          showRequester
                            ? (isOwner(req) ? 'You' : [req.requestedBy?.firstName, req.requestedBy?.lastName].filter(Boolean).join(' '))
                            : null,
                          req.department?.name,
                          `${itemCountOf(req)} ${itemCountOf(req) === 1 ? 'item' : 'items'}`
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 border-b border-gray-100 whitespace-nowrap align-top">
                      {(() => {
                        const stage = journeyStatus(req);
                        return (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${stage.className}`}
                            title={stage.hint || undefined}
                          >
                            {stage.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2.5 px-3 border-b border-gray-100 align-top">
                      <div className="flex items-center justify-end gap-2">
                        <ViewButton
                          size="xs"
                          showIcon={false}
                          onClick={() => navigate(`/app/requisitions/${req._id}`)}
                        />

                        {/* Department Head Actions */}
                        {actsAsDepartment(req) && isOwner(req) && req.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleSubmit(req._id, req)}
                              disabled={submittingId === req._id || itemCountOf(req) === 0}
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                itemCountOf(req) === 0
                                  ? 'Add at least one item before submitting'
                                  : 'Submit for Acceptance'
                              }
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

                        {/* HOD Approval Gate */}
                        {isDeptHead && actsAsDepartment(req) && req.status === 'pending_hod' && (
                          <>
                            <button
                              onClick={() => openActionModal(req, 'approve')}
                              className="px-2 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openActionModal(req, 'hod_reject')}
                              className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {/* Procurement Actions */}
                        {isProcurement && req.status === 'pending_acceptance' && (
                          <>
                            <button
                              onClick={() => openActionModal(req, 'accept')}
                              className="px-2 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => openActionModal(req, 'reject')}
                              className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {isProcurement && req.status === 'accepted' && (
                          <button
                            onClick={() => setRfqFor(req._id)}
                            className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark"
                          >
                            Create RFQ
                          </button>
                        )}

                        {isDeptHead && actsAsDepartment(req) && req.itemsDeliveredToStores && !req.itemsCollected && !storeRequestedIds.has(req._id) && (
                          <button
                            onClick={() => handleRequestFromStores(req)}
                            className="px-2 py-1 text-xs border border-primary rounded bg-primary hover:bg-primary-dark text-white transition-colors whitespace-nowrap"
                          >
                            Req. from Stores
                          </button>
                        )}
                        {/* Collected Badge - Show when items have been collected */}
                        {actsAsDepartment(req) && req.itemsCollected && (
                          <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-lg">
                            ✓ Collected
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              )}
          </table>
        </div>
        {!loading && <Pagination
          page={page}
          pages={pagination.pages}
          total={pagination.total}
          onPageChange={setPage}
          pageSize={limit}
          onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
          itemLabel="requisitions"
        />}
      </div>

      {/* Accept/Reject Action Modal */}
      <Modal
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        title={
          actionType === 'approve' ? 'Approve Requisition'
            : actionType === 'accept' ? 'Accept Requisition'
            : 'Reject Requisition'
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600">
              {actionType === 'approve'
                ? 'You are about to approve this requisition. It will be forwarded to Stores for an availability check.'
                : actionType === 'accept'
                ? 'You are about to accept this requisition. The RFQ form opens next, with this requisition already selected.'
                : 'You are about to reject this requisition. The requester will be notified.'}
            </p>
          </div>

          {/* Budget position. Shown before the approver acts, with the figures
              that make the overrun concrete rather than just a warning word. */}
          {budgetWarning && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                Over budget — {budgetWarning.departmentName || 'this department'} FY{budgetWarning.fiscalYear}
              </p>
              <dl className="mt-3 space-y-1 text-sm text-red-900">
                <div className="flex justify-between gap-4">
                  <dt className="text-red-700">Available before this request</dt>
                  <dd className="tabular-nums font-medium">
                    {formatCurrency(Number(budgetWarning.availableBefore || 0), budgetWarning.currency || getCurrentSbuCurrency())}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-red-700">This request</dt>
                  <dd className="tabular-nums font-medium">
                    {formatCurrency(Number(budgetWarning.requestAmount || 0), budgetWarning.currency || getCurrentSbuCurrency())}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-red-200 pt-1">
                  <dt className="text-red-700">Would be over by</dt>
                  <dd className="tabular-nums font-bold">
                    {formatCurrency(Math.abs(Number(budgetWarning.availableAfter || 0)), budgetWarning.currency || getCurrentSbuCurrency())}
                  </dd>
                </div>
              </dl>

              <label className="mt-4 block text-sm font-medium text-red-800">
                Reason for approving over budget <span className="text-red-600">(required)</span>
              </label>
              <textarea
                value={budgetOverrideReason}
                onChange={(e: any) => setBudgetOverrideReason(e.target.value)}
                rows={2}
                className="mt-1 w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white"
                placeholder="e.g. Emergency plant breakdown, approved verbally by COO"
              />
              <p className="mt-2 text-xs text-red-700">
                This is recorded against the requisition and Finance is notified.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {actionType === 'approve' || actionType === 'accept' ? 'Comments (Optional)' : 'Reason for Rejection (Required)'}
            </label>
            <textarea
              value={actionComment}
              onChange={(e: any) => setActionComment(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder={actionType === 'approve' || actionType === 'accept' ? 'Add any comments...' : 'Please provide a reason...'}
            />
          </div>

          <ModalFooter>
            <button
              onClick={() => setShowActionModal(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAction}
              disabled={actionLoading || (!!budgetWarning && !budgetOverrideReason.trim())}
              className={`flex-1 py-2.5 text-white rounded-xl font-medium ${
                budgetWarning
                  ? 'bg-red-600 hover:bg-red-700'
                  : actionType === 'approve' || actionType === 'accept'
                  ? 'bg-primary hover:bg-primary-dark'
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {actionLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : budgetWarning ? (
                'Approve over budget'
              ) : actionType === 'approve' ? (
                'Approve'
              ) : actionType === 'accept' ? (
                'Accept'
              ) : (
                'Reject'
              )}
            </button>
          </ModalFooter>
        </div>
      </Modal>

      <Drawer
        isOpen={createOpen}
        // The form decides: it offers to save a draft before anything is lost.
        onClose={() => createFormRef.current?.requestClose()}
        title="New Requisition"
      >
        <RequisitionForm ref={createFormRef} onCancel={closeCreate} onSaved={handleCreated} />
      </Drawer>

      <CreateRFQDrawer
        isOpen={!!rfqFor}
        requisitionId={rfqFor}
        onClose={() => setRfqFor(null)}
        onSaved={handleRfqCreated}
      />
    </div>
  );
}
