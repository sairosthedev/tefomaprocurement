import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementAPI, departmentAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatCurrency } from '../lib/constants';
import { isProcurementHead } from '@fossil/shared';
import PageHeader from '../components/PageHeader';
import { 
  FileText, 
  Calendar, 
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  DollarSign,
  Mail,
  Phone,
  ShoppingCart,
  Send,
  Package,
  ShieldCheck,
  UserCheck,
  Circle
} from 'lucide-react';
import Modal, { ConfirmModal } from '../components/Modal';

const statusColors: any = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700'
};

/** HOD selection is done by the head of the department that raised the requisition. */
function canUserHodSelect(user: any, compliance: any): boolean {
  if (user?.role === 'admin') return true;
  if (user?.role !== 'department_head') return false;

  const reqDeptId = compliance?.requestingDepartment?.id;
  const userDeptId = user?.department?._id || user?.department;

  // RFQ not linked to a department requisition — any department head may select.
  if (!reqDeptId) return true;

  return Boolean(userDeptId && String(userDeptId) === String(reqDeptId));
}

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState<any>(true);
  const [quotation, setQuotation] = useState<any>(null);
  const [sealedInfo, setSealedInfo] = useState<any>(null);
  const [closingRfq, setClosingRfq] = useState<any>(false);
  const [hodJustification, setHodJustification] = useState<any>('');
  const [authorizing, setAuthorizing] = useState<any>(false);
  const [showAcceptModal, setShowAcceptModal] = useState<any>(false);
  const [showRejectModal, setShowRejectModal] = useState<any>(false);
  const [rejectReason, setRejectReason] = useState<any>('');
  const [rejectComments, setRejectComments] = useState<any>('');
  const [processing, setProcessing] = useState<any>(false);
  const [showCreatePOModal, setShowCreatePOModal] = useState<any>(false);
  const [poFormData, setPOFormData] = useState<any>({
    deliveryAddress: {
      street: '',
      city: '',
      province: '',
      postalCode: ''
    },
    expectedDeliveryDate: '',
    termsAndConditions: '',
    notes: ''
  });

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const fetchQuotation = async () => {
    try {
      setLoading(true);
      setSealedInfo(null);
      const response = await procurementAPI.getQuotation(id);
      if (response.data.success) {
        setQuotation(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching quotation:', error);
      if (error.response?.data?.sealed) {
        setSealedInfo(error.response.data);
        setQuotation(null);
        return;
      }
      showToast(error.response?.data?.message || 'Failed to load quotation details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRfq = async () => {
    if (!sealedInfo?.rfqId) return;
    try {
      setClosingRfq(true);
      const res = await procurementAPI.closeRFQ(sealedInfo.rfqId);
      showToast(res.data.message || 'RFQ closed — bids are now visible', 'success');
      await fetchQuotation();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to close RFQ', 'error');
    } finally {
      setClosingRfq(false);
    }
  };

  const handleHodSelect = async () => {
    if (!hodJustification.trim()) {
      showToast('A selection justification is required', 'error');
      return;
    }
    try {
      setAuthorizing(true);
      await departmentAPI.hodSelectQuotation(quotation.rfq._id, {
        quotationId: quotation._id,
        justification: hodJustification.trim()
      });
      showToast('Quotation selected. Awaiting Procurement Manager authorization.', 'success');
      setHodJustification('');
      fetchQuotation();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to select quotation', 'error');
    } finally {
      setAuthorizing(false);
    }
  };

  const handlePmAuthorize = async () => {
    try {
      setAuthorizing(true);
      await procurementAPI.authorizeQuotation(quotation.rfq._id, {
        quotationId: quotation._id
      });
      showToast('Quotation authorized. Ready for acceptance.', 'success');
      fetchQuotation();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to authorize quotation', 'error');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleAccept = async () => {
    try {
      setProcessing(true);
      await procurementAPI.acceptQuotation(id, {});
      showToast('Quotation accepted successfully', 'success');
      setShowAcceptModal(false);
      fetchQuotation();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to accept quotation', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    try {
      setProcessing(true);
      await procurementAPI.rejectQuotation(id, {
        reason: rejectReason,
        comments: rejectComments
      });
      showToast('Quotation rejected successfully', 'success');
      setShowRejectModal(false);
      setRejectReason('');
      setRejectComments('');
      fetchQuotation();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to reject quotation', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreatePO = async () => {
    try {
      setProcessing(true);
      await procurementAPI.createPurchaseOrder({
        quotationId: id,
        ...poFormData
      });
      showToast('Purchase Order created successfully', 'success');
      setShowCreatePOModal(false);
      setPOFormData({
        deliveryAddress: {
          street: '',
          city: '',
          province: '',
          postalCode: ''
        },
        expectedDeliveryDate: '',
        termsAndConditions: '',
        notes: ''
      });
      fetchQuotation();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to create purchase order', 'error');
    } finally {
      setProcessing(false);
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

  if (sealedInfo) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <PageHeader
          backTo="/app/quotations"
          backLabel="Back to Quotations"
          title="Bid is sealed"
        />
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-sm text-amber-800 mb-2">
            {sealedInfo.message}
          </p>
          {sealedInfo.rfqNumber && (
            <p className="text-sm text-gray-600 mb-6">
              RFQ: <span className="font-mono font-medium">{sealedInfo.rfqNumber}</span>
              {sealedInfo.submissionDeadline && (
                <> · Deadline: {new Date(sealedInfo.submissionDeadline).toLocaleString('en-ZA')}</>
              )}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleCloseRfq}
              disabled={closingRfq}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {closingRfq ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Close RFQ &amp; Reveal Bids
            </button>
            {sealedInfo.rfqId && (
              <button
                type="button"
                onClick={() => navigate(`/app/rfqs/${sealedInfo.rfqId}`)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-800 rounded-xl font-medium hover:bg-amber-100"
              >
                View RFQ
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Quotation not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        backTo="/app/quotations"
        backLabel="Back to Quotations"
        title="Quotation"
        subtitle={`#${quotation.quotationNumber}`}
        actions={
          <>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[quotation.status]}`}>
              {quotation.status?.replace(/_/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase())}
            </span>
            {(quotation.status === 'submitted' || quotation.status === 'under_review') && (
              <>
                <button
                  onClick={() => setShowAcceptModal(true)}
                  disabled={!quotation.compliance?.fullyAuthorized}
                  title={
                    quotation.compliance?.fullyAuthorized
                      ? 'Accept this quotation'
                      : 'Complete HOD selection and Procurement Manager authorization first'
                  }
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4" />
                  Accept
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </>
            )}
            {quotation.status === 'accepted' && !quotation.existingPurchaseOrder && (
              <button
                onClick={() => setShowCreatePOModal(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
              >
                <ShoppingCart className="h-4 w-4" />
                Create Purchase Order
              </button>
            )}
            {quotation.existingPurchaseOrder && (
              <a
                href={`/app/purchase-orders/${quotation.existingPurchaseOrder._id}`}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
              >
                <ShoppingCart className="h-4 w-4" />
                View Purchase Order
              </a>
            )}
          </>
        }
      />

      {/* Acceptance compliance workflow */}
      {quotation.compliance && quotation.status !== 'accepted' && quotation.status !== 'rejected' && (
        (() => {
          const c = quotation.compliance;
          const role = user?.role;
          const procurementHead = isProcurementHead(user);
          const canHodSelect = canUserHodSelect(user, c);
          const canPmAuthorize = role === 'procurement_officer' || role === 'admin' || procurementHead;
          const reqDeptName = c.requestingDepartment?.name;
          const missingSteps: string[] = [];
          if (!c.minQuotationsMet) missingSteps.push('at least 3 quotations (or a waiver)');
          if (!c.hodSelected) {
            missingSteps.push(
              reqDeptName
                ? `HOD selection by the ${reqDeptName} department head`
                : 'HOD selection with justification'
            );
          }
          if (!c.pmAuthorized) missingSteps.push('Procurement Manager authorization');
          const Step = ({ done, title, children }: any) => (
            <div className="flex gap-3">
              <div className="mt-0.5">
                {done ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${done ? 'text-gray-900' : 'text-gray-700'}`}>{title}</p>
                {children}
              </div>
            </div>
          );
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Acceptance Authorization
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Complete every step below before Accept is enabled.
              </p>
              {!c.fullyAuthorized && missingSteps.length > 0 && (
                <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  <span className="font-medium">Accept is blocked until: </span>
                  {missingSteps.join(' → ')}
                </div>
              )}

              <div className="space-y-5">
                <Step
                  done={c.minQuotationsMet}
                  title={`Minimum 3 competitive quotations${c.waived ? ' (waived)' : ''}`}
                >
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.quotationCount} quotation{c.quotationCount === 1 ? '' : 's'} on this RFQ
                    {!c.minQuotationsMet && ' — need at least 3 or an approved waiver'}
                  </p>
                </Step>

                <Step
                  done={c.hodSelected}
                  title={
                    reqDeptName
                      ? `HOD selection — ${reqDeptName} department`
                      : 'HOD selection with justification'
                  }
                >
                  {c.hodSelected ? (
                    <p className="text-xs text-gray-500 mt-0.5">Justification: {c.hodJustification}</p>
                  ) : canHodSelect ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={hodJustification}
                        onChange={(e: any) => setHodJustification(e.target.value)}
                        rows={2}
                        placeholder="Justification for selecting this quotation (required)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={handleHodSelect}
                        disabled={authorizing || !c.minQuotationsMet}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                      >
                        {authorizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                        Select as HOD
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 mt-0.5">
                      {reqDeptName
                        ? `Waiting for the ${reqDeptName} department head to select this quotation with a justification.`
                        : 'Waiting for the requesting department head to select this quotation.'}
                      {procurementHead && reqDeptName && (
                        <span className="block mt-1 text-gray-500">
                          As Head of Procurement you authorize in step 3 after that department&apos;s HOD completes step 2.
                        </span>
                      )}
                    </p>
                  )}
                </Step>

                <Step done={c.pmAuthorized} title="Procurement Manager authorization">
                  {c.pmAuthorized ? (
                    <p className="text-xs text-gray-500 mt-0.5">Authorized.</p>
                  ) : canPmAuthorize ? (
                    <div className="mt-2 space-y-2">
                      {!c.hodSelected && (
                        <p className="text-xs text-amber-600">
                          Complete HOD selection (step 2) before you can authorize here.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handlePmAuthorize}
                        disabled={authorizing || !c.hodSelected}
                        title={!c.hodSelected ? 'HOD must select this quotation first' : 'Authorize as Procurement Manager'}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                      >
                        {authorizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Authorize as Procurement Manager
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 mt-0.5">Awaiting Procurement Manager authorization.</p>
                  )}
                </Step>
              </div>

              {c.fullyAuthorized && (
                <div className="mt-5 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Fully authorized — you can now accept this quotation.
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quotation Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-500">Quotation Number</label>
              <p className="text-sm font-medium text-gray-900 mt-1 font-mono">{quotation.quotationNumber}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <p className="text-sm font-medium text-gray-900 mt-1 capitalize">
                {quotation.status?.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Total Amount</label>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {formatCurrency(quotation.totalAmount || 0)}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Currency</label>
              <p className="text-sm font-medium text-gray-900 mt-1">{quotation.currency || 'ZAR'}</p>
            </div>
          </div>
        </div>

        {/* Supplier Info */}
        {quotation.supplier && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Supplier Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Company Name</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{quotation.supplier.companyName}</p>
              </div>
              {quotation.supplier.contactEmail && (
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {quotation.supplier.contactEmail}
                  </p>
                </div>
              )}
              {quotation.supplier.contactPhone && (
                <div>
                  <label className="text-sm text-gray-500">Phone</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {quotation.supplier.contactPhone}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RFQ Info */}
        {quotation.rfq && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Related RFQ</h3>
            <p className="text-sm text-gray-700">
              <span className="font-medium">{quotation.rfq.rfqNumber}</span>
              {' - '}
              {quotation.rfq.title || quotation.rfq.description}
            </p>
            {quotation.rfq.submissionDeadline && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                Submission Deadline: {new Date(quotation.rfq.submissionDeadline).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Items */}
        {quotation.items && quotation.items.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quoted Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Description</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Quantity</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Unit</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Unit Price</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item: any, index: any) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        {item.specifications && (
                          <p className="text-xs text-gray-500 mt-1">{item.specifications}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900">{item.quantity}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900">{item.unit}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900">
                        {formatCurrency(item.unitPrice || 0)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                        {formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="py-3 px-4 text-right font-semibold text-gray-900">
                      Total Amount:
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">
                      {formatCurrency(quotation.totalAmount || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Submitted By */}
        {quotation.submittedBy && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Submitted By</h3>
            <p className="text-sm text-gray-700">
              {quotation.submittedBy.firstName} {quotation.submittedBy.lastName}
            </p>
            {quotation.submittedBy.email && (
              <p className="text-xs text-gray-500 mt-1">{quotation.submittedBy.email}</p>
            )}
            {quotation.submittedAt && (
              <p className="text-xs text-gray-500 mt-1">
                Submitted: {new Date(quotation.submittedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        {quotation.notes && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{quotation.notes}</p>
          </div>
        )}
      </div>

      {/* Accept Modal */}
      <Modal
        isOpen={showAcceptModal}
        onClose={() => setShowAcceptModal(false)}
        title="Accept Quotation"
      >
        <p className="text-gray-700 mb-6">Are you sure you want to accept this quotation?</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowAcceptModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={processing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Accept Quotation
          </button>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
          setRejectComments('');
        }}
        title="Reject Quotation"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason *
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e: any) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Enter rejection reason"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comments</label>
            <textarea
              value={rejectComments}
              onChange={(e: any) => setRejectComments(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Additional comments (optional)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => {
              setShowRejectModal(false);
              setRejectReason('');
              setRejectComments('');
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={processing || !rejectReason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Reject Quotation
          </button>
        </div>
      </Modal>

      {/* Create PO Modal */}
      <Modal
        isOpen={showCreatePOModal}
        onClose={() => setShowCreatePOModal(false)}
        title="Create Purchase Order"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Street</label>
              <input
                type="text"
                value={poFormData.deliveryAddress.street}
                onChange={(e: any) => setPOFormData({
                  ...poFormData,
                  deliveryAddress: { ...poFormData.deliveryAddress, street: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <input
                type="text"
                value={poFormData.deliveryAddress.city}
                onChange={(e: any) => setPOFormData({
                  ...poFormData,
                  deliveryAddress: { ...poFormData.deliveryAddress, city: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Province</label>
              <input
                type="text"
                value={poFormData.deliveryAddress.province}
                onChange={(e: any) => setPOFormData({
                  ...poFormData,
                  deliveryAddress: { ...poFormData.deliveryAddress, province: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
              <input
                type="text"
                value={poFormData.deliveryAddress.postalCode}
                onChange={(e: any) => setPOFormData({
                  ...poFormData,
                  deliveryAddress: { ...poFormData.deliveryAddress, postalCode: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery Date</label>
            <input
              type="date"
              value={poFormData.expectedDeliveryDate}
              onChange={(e: any) => setPOFormData({ ...poFormData, expectedDeliveryDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Terms & Conditions</label>
            <textarea
              value={poFormData.termsAndConditions}
              onChange={(e: any) => setPOFormData({ ...poFormData, termsAndConditions: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={poFormData.notes}
              onChange={(e: any) => setPOFormData({ ...poFormData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowCreatePOModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePO}
            disabled={processing}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            Create Purchase Order
          </button>
        </div>
      </Modal>
    </div>
  );
}
