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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());

  const isStoresOfficer = user?.role === 'stores_officer';

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchRequisitions();
  }, [page, limit, searchTerm]);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      const response = isStoresOfficer 
        ? await storesAPI.getStoreRequisitions({ search: searchTerm, page, limit })
        : await departmentAPI.getStoreRequisitions({ search: searchTerm, page, limit });
      
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
    
    try {
      setActionLoading(true);
      await storesAPI.approveStoreRequisition(selectedRequisition._id, { 
        comments: actionComment.trim() || undefined 
      });
      showToast('Store requisition approved — record who is collecting', 'success');
      setShowApproveModal(false);
      setActionComment('');
      fetchRequisitions();
      // Issuing is the next step for the same officer, so open it straight away.
      setSelectedRequisition({ ...selectedRequisition, status: 'approved' });
      setCollectedBy({ name: '', idNumber: '', department: '', contactNumber: '' });
      setShowIssueModal(true);
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
      const res = await storesAPI.issueStock(selectedRequisition._id, {
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

  return (
    <div className="p-8">
      <PageHeader
        title="Store Requisitions"
        subtitle={
          isStoresOfficer
            ? 'Hand delivered goods over to the departments that ordered them'
            : 'Collections of delivered goods, raised from your requisitions'
        }
        bottomSpacing="mb-4"
      />

      {/* Toolbar */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative w-full sm:w-52 md:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search requisitions..."
              value={searchTermInput}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">SR #</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">
                    {isStoresOfficer ? 'Requested By' : 'Items'}
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton cols={5} />
              ) : requisitions.length === 0 ? (
                <tbody><tr><td colSpan={5} className="text-center py-12 text-gray-500">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p>No store requisitions found</p>
                </td></tr></tbody>
              ) : (
              <tbody>
                {requisitions.map((req: any) => (
                  <tr key={req._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                    <td className="py-2 px-3 border-b border-gray-100 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-primary">
                        {req.requisitionNumber || `SR-${req._id.slice(-6).toUpperCase()}`}
                      </span>
                      {req.purchaseRequisition?.requisitionNumber && (
                        <span className="block text-xs text-gray-500">for {req.purchaseRequisition.requisitionNumber}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
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
                    <td className="py-2 px-3 border-b border-gray-100">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[req.status] || statusColors.pending}`}>
                        {req.status || 'Pending'}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100 text-gray-500">
                      {new Date(req.createdAt).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
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
                                setShowApproveModal(true);
                              }}
                              className="px-2 py-1 text-xs font-medium border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequisition(req);
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
                              setShowIssueModal(true);
                            }}
                            className="px-2 py-1 text-xs font-medium border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors whitespace-nowrap"
                          >
                            Issue Items
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
        title="Requisition Details"
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
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[selectedRequisition.status]}`}>
                    {selectedRequisition.status}
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
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Approve
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
              disabled={actionLoading || !actionComment.trim()}
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
        title="Issue Stock"
        size="lg"
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
                  Issuing...
                </>
              ) : (
                'Issue Items'
              )}
            </button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}

