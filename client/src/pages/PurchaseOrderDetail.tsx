import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api, { procurementAPI, financeAPI, cooAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/constants';
import { cooThresholdLabel, usdEquivalentLabel } from '../lib/cooApproval';
import { PO_CANCELLATION_REASONS, isProcurementHead } from '@fossil/shared';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import CancelWorkflowModal from '../components/CancelWorkflowModal';
import { canCancelPurchaseOrder, purchaseOrderCancelApiBase } from '../lib/cancellationAccess';
import { 
  ShoppingCart, 
  Calendar, 
  Building2,
  CheckCircle,
  XCircle,
  Ban,
  Clock,
  Loader2,
  DollarSign,
  FileText,
  Truck,
  User
} from 'lucide-react';

const statusColors: any = {
  draft: 'bg-gray-100 text-gray-700',
  pending_proc_hod: 'bg-fuchsia-100 text-fuchsia-700',
  pending_dept_hod: 'bg-fuchsia-100 text-fuchsia-700',
  pending_hod: 'bg-fuchsia-100 text-fuchsia-700',
  pending_finance: 'bg-amber-100 text-amber-700',
  pending_coo: 'bg-purple-100 text-purple-700',
  pending_approvals: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  issued: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-700'
};

// The department-head PO step was removed; orders submitted before then may
// still sit at it, and the Head of Procurement takes them on from there.
const LEGACY_DEPT_HOD_STATUSES = ['pending_dept_hod', 'pending_hod', 'pending_approvals'];

function statusLabel(status: string) {
  if (status === 'pending_proc_hod' || LEGACY_DEPT_HOD_STATUSES.includes(status)) return 'Pending Head of Procurement';
  return status?.replace(/_/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase());
}

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState<any>(true);
  const [po, setPo] = useState<any>(null);
  const [submitting, setSubmitting] = useState<any>(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [deciding, setDeciding] = useState(false);

  // The Head of Procurement is stored as a department_head but raises POs too.
  // Admins read POs but take no step on them.
  const isProcurement = user?.role === 'procurement_officer' || isProcurementHead(user);
  const isFinance = user?.role === 'finance';
  const isCOO = user?.role === 'coo';
  const mayCancelPo = canCancelPurchaseOrder(user, po);

  useEffect(() => {
    fetchPurchaseOrder();
  }, [id]);

  const fetchPurchaseOrder = async () => {
    try {
      setLoading(true);
      let response: any;
      if (isFinance) {
        response = await financeAPI.getPurchaseOrder(id);
      } else if (isCOO) {
        response = await cooAPI.getPurchaseOrder(id);
      } else {
        response = await procurementAPI.getPurchaseOrder(id);
      }
      
      if (response.data.success) {
        setPo(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching purchase order:', error);
      showToast(error.response?.data?.message || 'Failed to load purchase order details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await procurementAPI.submitPurchaseOrder(id);
      showToast('Purchase order submitted successfully', 'success');
      fetchPurchaseOrder();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to submit purchase order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPurchaseOrder = async ({
    reasonCode,
    comments
  }: {
    reasonCode: string;
    comments?: string;
  }) => {
    try {
      setCancelling(true);
      const payload = { reasonCode, comments };
      const base = purchaseOrderCancelApiBase(user);
      if (base === '/finance') {
        await financeAPI.cancelPurchaseOrder(id, payload);
      } else if (base === '/coo') {
        await cooAPI.cancelPurchaseOrder(id, payload);
      } else {
        await procurementAPI.cancelPurchaseOrder(id, payload);
      }
      showToast('Purchase order cancelled', 'success');
      fetchPurchaseOrder();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to cancel purchase order', 'error');
      throw error;
    } finally {
      setCancelling(false);
    }
  };

  // The approver whose step the order is at, by the API that takes it.
  const approvalApi = !po
    ? null
    : isProcurementHead(user) &&
        (po.status === 'pending_proc_hod' || (LEGACY_DEPT_HOD_STATUSES.includes(po.status) && !po.hodApproved))
      ? 'department'
      : isFinance && po.status === 'pending_finance'
        ? 'finance'
        : isCOO && po.status === 'pending_coo'
          ? 'coo'
          : null;

  const closeDecision = () => {
    setDecision(null);
    setDecisionComment('');
  };

  const handleDecision = async () => {
    if (!approvalApi || !decision) return;
    if (decision === 'reject' && !decisionComment.trim()) {
      showToast('Give a reason for rejecting', 'error');
      return;
    }
    try {
      setDeciding(true);
      const comment = decisionComment.trim();
      if (decision === 'approve') {
        const step = approvalApi === 'department' ? 'proc-approve' : 'approve';
        await api.put(`/${approvalApi}/purchase-orders/${id}/${step}`, { comments: comment || undefined });
        showToast('Purchase order approved', 'success');
      } else {
        await api.put(`/${approvalApi}/purchase-orders/${id}/reject`, { reason: comment, comments: comment });
        showToast('Purchase order rejected', 'success');
      }
      closeDecision();
      fetchPurchaseOrder();
    } catch (error: any) {
      showToast(error.response?.data?.message || `Failed to ${decision} the purchase order`, 'error');
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Purchase Order not found</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader
        backTo="/app/purchase-orders"
        backLabel="Back to Purchase Orders"
        title="Purchase Order"
        subtitle={`#${po.poNumber}`}
        actions={
          <>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[po.status] || 'bg-gray-100 text-gray-700'}`}>
              {statusLabel(po.status)}
            </span>
            {approvalApi && (
              <>
                <button
                  type="button"
                  onClick={() => setDecision('approve')}
                  className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('reject')}
                  className="px-4 py-2 text-sm font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </>
            )}
            {isProcurement && po.status === 'draft' && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Submit for Approval
              </button>
            )}
            {mayCancelPo && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                disabled={cancelling}
                className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                Cancel PO
              </button>
            )}
          </>
        }
      />

      <Modal
        isOpen={!!decision}
        onClose={() => { if (!deciding) closeDecision(); }}
        title={decision === 'approve' ? `Approve ${po.poNumber}?` : `Reject ${po.poNumber}?`}
        subtitle={`${po.supplier?.companyName || 'Supplier'} · ${formatCurrency(po.totalAmount || 0, po.currency)}`}
        footer={
          <>
            <button
              type="button"
              onClick={closeDecision}
              disabled={deciding}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDecision}
              disabled={deciding || (decision === 'reject' && !decisionComment.trim())}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                decision === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'
              }`}
            >
              {deciding && <Loader2 className="h-4 w-4 animate-spin" />}
              {decision === 'reject' ? 'Reject' : 'Approve'}
            </button>
          </>
        }
      >
        <textarea
          value={decisionComment}
          onChange={(e) => setDecisionComment(e.target.value)}
          rows={3}
          placeholder={decision === 'reject' ? 'Reason for rejecting (required)' : 'Comments (optional)'}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Modal>

      <CancelWorkflowModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel purchase order"
        description="The supplier will be notified. Cancellation is blocked if goods have been received or an invoice is active."
        reasons={PO_CANCELLATION_REASONS}
        onConfirm={handleCancelPurchaseOrder}
      />


      {po.status === 'cancelled' && po.cancellationReason && (
        <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Cancellation reason:</strong> {po.cancellationReason}
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchase Order Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-500">PO Number</label>
              <p className="text-sm font-medium text-gray-900 mt-1 font-mono break-all">{po.poNumber}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {statusLabel(po.status)}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Total Amount</label>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {formatCurrency(po.totalAmount || 0, po.currency)}
              </p>
              {usdEquivalentLabel(po) && (
                <p className="text-xs text-gray-500 mt-0.5">{usdEquivalentLabel(po)}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-500">Date</label>
              <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(po.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Supplier Info */}
        {po.supplier && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Supplier Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Company Name</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{po.supplier.companyName}</p>
              </div>
              {po.supplier.contactEmail && (
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{po.supplier.contactEmail}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items */}
        {po.items && po.items.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Description</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Quantity</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Unit Price</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item: any, index: any) => (
                    <tr key={index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                      <td className="py-2 px-3 border-b border-gray-100">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        {item.unit && (
                          <p className="text-xs text-gray-500 mt-1">Unit: {item.unit}</p>
                        )}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right text-gray-900">{item.quantity}</td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right text-gray-900">
                        {formatCurrency(item.unitPrice || 0, po.currency)}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right font-medium text-gray-900">
                        {formatCurrency((item.quantity || 0) * (item.unitPrice || 0), po.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="py-2.5 px-4 text-right font-semibold text-gray-900">
                      Total Amount:
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100 text-right font-bold text-lg text-gray-900">
                      {formatCurrency(po.totalAmount || 0, po.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Related Requisition */}
        {po.purchaseRequisition && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Related Requisition</h3>
            <p className="text-sm text-gray-700">
              <span className="font-medium">{po.purchaseRequisition.requisitionNumber}</span>
              {' - '}
              {po.purchaseRequisition.title}
            </p>
            {po.purchaseRequisition.department && (
              <p className="text-xs text-gray-500 mt-1">
                Department: {po.purchaseRequisition.department.name}
              </p>
            )}
          </div>
        )}

        {/* Created By */}
        {po.createdBy && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <User className="h-5 w-5" />
              Created By
            </h3>
            <p className="text-sm text-gray-700">
              {po.createdBy.firstName} {po.createdBy.lastName}
            </p>
            {po.createdBy.email && (
              <p className="text-xs text-gray-500 mt-1">{po.createdBy.email}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
