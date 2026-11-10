import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { storesAPI, departmentAPI } from '../lib/api';
import { 
  Search, Package, CheckCircle, XCircle, 
  Loader2, Clock, Truck, AlertCircle
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import ViewButton from '../components/ViewButton';
import Modal, { ModalFooter } from '../components/Modal';
import TableSkeleton from '../components/TableSkeleton';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import FilterSelect from '../components/FilterSelect';
import {
  STORES_TEXT_LIMITS,
  TEXT_LIMITS,
  validateStockIssue,
  validateStoreRequisitionApproval,
  validateStoreRequisitionRejection
} from '@fossil/shared';
import FieldError from '../components/FieldError';
import { useFormValidation } from '../lib/useFormValidation';

type Collector = { name: string; idNumber: string; department: string; contactNumber: string };

/** Who collected, as sent: left out when nothing was filled in, so an issue is never blocked. */
const collectorPayload = (c: Collector) =>
  Object.values(c).some((value) => value.trim())
    ? {
        name: c.name.trim(),
        idNumber: c.idNumber.trim() || undefined,
        department: c.department.trim() || undefined,
        contactNumber: c.contactNumber.trim() || undefined
      }
    : undefined;

/**
 * Where a store requisition stands, in the words of the hand-over: a new
 * request, ready (stock checked, requester told to come), then collected.
 */
const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  pending: { label: 'New request', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Ready to collect', cls: 'bg-blue-100 text-blue-700' },
  partially_issued: { label: 'Part collected', cls: 'bg-purple-100 text-purple-700' },
  issued: { label: 'Collected', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600' }
};

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'New requests' },
  { value: 'approved', label: 'Ready to collect' },
  { value: 'partially_issued', label: 'Part collected' },
  { value: 'issued', label: 'Collected' },
  { value: 'rejected', label: 'Rejected' }
];

const itemName = (line: any): string => line.item?.name || line.item?.description || line.description || 'Item';

/** "Office chair × 10", and how many more lines there are. */
function ItemsSummary({ items }: { items: any[] }) {
  if (!items?.length) return <span className="text-gray-400">—</span>;
  const [first, ...rest] = items;
  return (
    <span className="text-gray-900">
      {itemName(first)} <span className="text-gray-500">× {first.quantityRequested}</span>
      {rest.length > 0 && <span className="block text-xs text-gray-500">+{rest.length} more</span>}
    </span>
  );
}

export default function StoreRequisitions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  // A link from an IR opens the list already searched for its store requisition.
  const [searchParams] = useSearchParams();
  const [searchTermInput, setSearchTerm] = useState<any>(() => searchParams.get('search') || '');
  // The box shows what's typed; the list is fetched once typing pauses.
  const searchTerm = useDebouncedValue(searchTermInput);
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
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  const approveCheck = useFormValidation(validateStoreRequisitionApproval, { comments: actionComment });
  const rejectCheck = useFormValidation(validateStoreRequisitionRejection, { comments: actionComment });
  const issueCheck = useFormValidation(
    (c: Collector) => validateStockIssue({ collectedBy: collectorPayload(c) }),
    collectedBy
  );

  const isStoresOfficer = user?.role === 'stores_officer';
  // To the department, a new request is simply with stores.
  const statusOf = (status: string) =>
    status === 'pending' && !isStoresOfficer
      ? { ...STATUS.pending, label: 'With stores' }
      : STATUS[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchRequisitions();
  }, [page, limit, searchTerm, statusFilter]);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      const params = { search: searchTerm, status: statusFilter || undefined, page, limit };
      const response = isStoresOfficer
        ? await storesAPI.getStoreRequisitions(params)
        : await departmentAPI.getStoreRequisitions(params);
      
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

  const handleApprove = async () => {
    if (!selectedRequisition) return;
    if (!approveCheck.check()) return;

    try {
      setActionLoading(true);
      await storesAPI.approveStoreRequisition(selectedRequisition._id, { 
        comments: actionComment.trim() || undefined 
      });
      showToast(`${selectedRequisition.requisitionNumber} is ready. The requester has been told to come and collect it.`, 'success');
      setShowApproveModal(false);
      setActionComment('');
      setSelectedRequisition(null);
      fetchRequisitions();
    } catch (error: any) {
      if (!approveCheck.fromServer(error)) {
        showToast(error.response?.data?.message || 'Could not mark it ready', 'error');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequisition) return;
    if (!rejectCheck.check()) return;

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
      if (!rejectCheck.fromServer(error)) {
        showToast(error.response?.data?.message || 'Failed to reject requisition', 'error');
      }
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
    if (!issueCheck.check()) return;
    try {
      setActionLoading(true);
      const res = await storesAPI.issueStock(selectedRequisition._id, {
        collectedBy: collectorPayload(collectedBy)
      });
      showToast('Handed over. Print the issue note for them to sign.', 'success');
      setShowIssueModal(false);
      setCollectedBy({ name: '', idNumber: '', department: '', contactNumber: '' });
      fetchRequisitions();
      // Back to the request, where printing the issue note for signature is next.
      const issued = res.data?.data;
      setSelectedRequisition({
        ...selectedRequisition,
        ...(issued
          ? {
              status: issued.status,
              issueNoteNumber: issued.issueNoteNumber,
              collectedBy: issued.collectedBy,
              items: selectedRequisition.items?.map((item: any, i: number) => ({
                ...item,
                quantityIssued: issued.items?.[i]?.quantityIssued ?? item.quantityIssued
              }))
            }
          : { status: 'issued' })
      });
      setShowViewModal(true);
    } catch (error: any) {
      if (!issueCheck.fromServer(error)) {
        showToast(error.response?.data?.message || 'Could not hand the items over', 'error');
      }
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

  return (
    <div className="p-8">
      <PageHeader
        title="Store Requisitions"
        subtitle={
          isStoresOfficer
            ? 'Requests to collect items from stores. Mark each one ready when the items are set aside, then hand them over when someone comes for them.'
            : 'Your requests to collect items from stores'
        }
        bottomSpacing="mb-4"
      />

      {/* Toolbar */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-end">
          <div className="relative w-full sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search requisitions..."
              value={searchTermInput}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <FilterSelect
            label="Status"
            size="sm"
            options={STATUS_FILTERS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>

      {/* List */}
      <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Request</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Items</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Requested by</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton cols={6} />
              ) : requisitions.length === 0 ? (
                <tbody><tr><td colSpan={6} className="text-center py-12 text-gray-500">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p>{statusFilter ? 'Nothing with this status' : 'No store requisitions yet'}</p>
                </td></tr></tbody>
              ) : (
              <tbody>
                {requisitions.map((req: any) => (
                  <tr key={req._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                    <td className="py-2 px-3 border-b border-gray-100 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-primary">
                        {req.requisitionNumber || `SR-${req._id.slice(-6).toUpperCase()}`}
                      </span>
                      {/* Collections name the IR they are for; older stock requests have none. */}
                      <span className="block text-xs text-gray-500">
                        {req.purchaseRequisition?.requisitionNumber ? `for ${req.purchaseRequisition.requisitionNumber}` : 'Stock request'}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <ItemsSummary items={req.items} />
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <p className="text-gray-900 whitespace-nowrap">
                        {req.requestedBy?.firstName} {req.requestedBy?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{req.department?.name}</p>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusOf(req.status).cls}`}>
                        {statusOf(req.status).label}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100 text-gray-500 whitespace-nowrap">
                      {new Date(req.createdAt).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <ViewButton
                          size="xs"
                          showIcon={false}
                          onClick={() => { setSelectedRequisition(req); setShowViewModal(true); }}
                        />
                        {isStoresOfficer && req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedRequisition(req);
                                approveCheck.reset();
                                setShowApproveModal(true);
                              }}
                              title="The items are set aside: tell the requester to come and collect"
                              className="px-2 py-1 text-xs font-medium border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors whitespace-nowrap"
                            >
                              Mark ready
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequisition(req);
                                rejectCheck.reset();
                                setShowRejectModal(true);
                              }}
                              className="px-2 py-1 text-xs font-medium border border-red-200 text-red-700 rounded hover:bg-red-50 transition-colors"
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
                              issueCheck.reset();
                              setShowIssueModal(true);
                            }}
                            className="px-2 py-1 text-xs font-medium border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors whitespace-nowrap"
                          >
                            Hand over
                          </button>
                        )}
                        {['partially_issued', 'issued'].includes(req.status) && (
                          <button
                            onClick={() => handlePrintIssueNote(req)}
                            disabled={printingId === req._id}
                            className="px-2 py-1 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {printingId === req._id ? 'Opening…' : 'Issue Note'}
                          </button>
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

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={selectedRequisition?.requisitionNumber || 'Store requisition'}
        size="lg"
      >
        {selectedRequisition && (
          <div className="space-y-4">
            <div>
            </div>

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
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusOf(selectedRequisition.status).cls}`}>
                    {statusOf(selectedRequisition.status).label}
                  </span>
                </p>
              </div>
            </div>

            {selectedRequisition.purchaseRequisition && (
              <div>
                <label className="text-sm text-gray-500 block">Collecting for</label>
                <p className="text-sm">
                  {isStoresOfficer ? (
                    <span className="font-mono font-medium">{selectedRequisition.purchaseRequisition.requisitionNumber}</span>
                  ) : (
                    <Link
                      to={`/app/requisitions/${selectedRequisition.purchaseRequisition._id}`}
                      className="font-mono font-medium text-primary hover:underline"
                    >
                      {selectedRequisition.purchaseRequisition.requisitionNumber}
                    </Link>
                  )}
                  {selectedRequisition.purchaseRequisition.title && (
                    <span className="text-gray-600"> · {selectedRequisition.purchaseRequisition.title}</span>
                  )}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Purpose</label>
              <p className="text-sm text-gray-700 mb-4">{selectedRequisition.purpose || 'N/A'}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Items Requested</label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Item</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Qty Requested</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Qty Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRequisition.items?.map((item: any, index: any) => (
                      <tr key={index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                        <td className="py-2 px-3 border-b border-gray-100">
                          {item.item?.name || item.item?.description || item.description || 'N/A'}
                        </td>
                        <td className="py-2 px-3 border-b border-gray-100">{item.quantityRequested || item.quantity || '-'}</td>
                        <td className="py-2 px-3 border-b border-gray-100">{item.quantityIssued || '-'}</td>
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
        title="Ready for collection"
      >
        <div ref={approveCheck.formRef} className="space-y-4">
          <p className="text-sm text-gray-600">
            Stock is checked at this store, and {selectedRequisition?.requestedBy?.firstName || 'the requester'} is
            told to come and collect. Hand the items over when they arrive.
          </p>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Note to the requester (optional)</label>
            <textarea
              value={actionComment}
              onChange={(e: any) => setActionComment(e.target.value)}
              rows={3}
              maxLength={TEXT_LIMITS.long}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="e.g. Collect from the main store after 2pm"
              {...approveCheck.invalid('comments')}
            />
            <FieldError message={approveCheck.errors.comments} />
          </div>

          <ModalFooter>
            <button
              onClick={() => {
                setShowApproveModal(false);
                setActionComment('');
                setSelectedRequisition(null);
              }}
              disabled={actionLoading}
              className="px-4 py-2 text-sm text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="px-4 py-2 text-sm bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Mark ready
                </>
              )}
            </button>
          </ModalFooter>
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
        <div ref={rejectCheck.formRef} className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this store requisition.
          </p>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea
              value={actionComment}
              onChange={(e: any) => setActionComment(e.target.value)}
              rows={3}
              maxLength={TEXT_LIMITS.long}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Explain why this requisition is being rejected..."
              {...rejectCheck.invalid('comments')}
            />
            <FieldError message={rejectCheck.errors.comments} />
          </div>

          <ModalFooter>
            <button
              onClick={() => {
                setShowRejectModal(false);
                setActionComment('');
                setSelectedRequisition(null);
              }}
              disabled={actionLoading}
              className="px-4 py-2 text-sm text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="px-4 py-2 text-sm border border-red-200 text-red-700 font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2"
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
          </ModalFooter>
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
        title="Hand over"
        size="lg"
      >
        <div ref={issueCheck.formRef} className="space-y-4">
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
                maxLength={TEXT_LIMITS.name}
                placeholder="e.g. Tapiwa Ncube"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                {...issueCheck.invalid('collectedBy.name')}
              />
              <FieldError message={issueCheck.errors['collectedBy.name']} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ID / Employee no.</label>
              <input
                type="text"
                value={collectedBy.idNumber}
                onChange={(e: any) => setCollectedBy((prev) => ({ ...prev, idNumber: e.target.value }))}
                maxLength={STORES_TEXT_LIMITS.idNumber}
                placeholder="Employee or national ID"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                {...issueCheck.invalid('collectedBy.idNumber')}
              />
              <FieldError message={issueCheck.errors['collectedBy.idNumber']} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <input
                type="text"
                value={collectedBy.department}
                onChange={(e: any) => setCollectedBy((prev) => ({ ...prev, department: e.target.value }))}
                maxLength={TEXT_LIMITS.name}
                placeholder="e.g. Workshop"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                {...issueCheck.invalid('collectedBy.department')}
              />
              <FieldError message={issueCheck.errors['collectedBy.department']} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact number</label>
              <input
                type="text"
                value={collectedBy.contactNumber}
                onChange={(e: any) => setCollectedBy((prev) => ({ ...prev, contactNumber: e.target.value }))}
                maxLength={TEXT_LIMITS.phone}
                placeholder="Phone number"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                {...issueCheck.invalid('collectedBy.contactNumber')}
              />
              <FieldError message={issueCheck.errors['collectedBy.contactNumber']} />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Leave blank only if nobody is available to sign — the issue note then prints an empty
            block to complete by hand.
          </p>

          <ModalFooter>
            <button
              onClick={() => {
                setShowIssueModal(false);
                setCollectedBy({ name: '', idNumber: '', department: '', contactNumber: '' });
                setSelectedRequisition(null);
              }}
              disabled={actionLoading}
              className="px-4 py-2 text-sm text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleIssue}
              disabled={actionLoading}
              className="px-4 py-2 text-sm bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Handing over...
                </>
              ) : (
                'Hand over'
              )}
            </button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}

