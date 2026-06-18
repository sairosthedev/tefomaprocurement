import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { 
  Calendar, 
  Users, 
  Send,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';

const statusColors: any = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  closed: 'bg-amber-100 text-amber-700',
  evaluating: 'bg-purple-100 text-purple-700',
  awarded: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

export default function RFQDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState<any>(true);
  const [closing, setClosing] = useState<any>(false);
  const [rfq, setRfq] = useState<any>(null);

  useEffect(() => {
    fetchRFQ();
  }, [id]);

  const fetchRFQ = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getRFQ(id);
      if (response.data.success) {
        setRfq(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching RFQ:', error);
      showToast(error.response?.data?.message || 'Failed to load RFQ details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    const enteredItems = (rfq?.items || []).filter((item: any) => item.description?.trim());
    if (enteredItems.length === 0) {
      showToast('RFQ must have at least one item before it can be sent to suppliers', 'error');
      return;
    }

    try {
      await procurementAPI.publishRFQ(id);
      showToast('RFQ published successfully', 'success');
      fetchRFQ();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to publish RFQ', 'error');
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Close this RFQ and reveal submitted bids for evaluation? Suppliers will no longer be able to submit.')) {
      return;
    }
    try {
      setClosing(true);
      const res = await procurementAPI.closeRFQ(id);
      showToast(res.data.message || 'RFQ closed — bids are now visible', 'success');
      fetchRFQ();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to close RFQ', 'error');
    } finally {
      setClosing(false);
    }
  };

  const bidsAreSealed = rfq?.status === 'open' && (
    !rfq?.submissionDeadline || new Date(rfq.submissionDeadline) > new Date()
  );

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">RFQ not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        backTo="/app/rfqs"
        backLabel="Back to RFQs"
        title={rfq.title}
        subtitle={`#${rfq.rfqNumber}`}
        actions={
          <>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[rfq.status]}`}>
              {rfq.status?.charAt(0).toUpperCase() + rfq.status?.slice(1)}
            </span>
            {rfq.status === 'draft' && (
              <button
                onClick={handlePublish}
                disabled={(rfq.items || []).filter((item: any) => item.description?.trim()).length === 0}
                className="px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
                title={
                  (rfq.items || []).filter((item: any) => item.description?.trim()).length === 0
                    ? 'Add at least one item before publishing'
                    : undefined
                }
              >
                <Send className="h-4 w-4" />
                Publish RFQ
              </button>
            )}
            {rfq.status === 'open' && (
              <button
                onClick={handleClose}
                disabled={closing}
                className="px-4 py-2.5 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Close RFQ & Reveal Bids
              </button>
            )}
          </>
        }
      />

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">RFQ Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">RFQ Number</label>
              <p className="text-sm font-medium text-gray-900 mt-1">{rfq.rfqNumber}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{rfq.status}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Submission Deadline</label>
              <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(rfq.submissionDeadline).toLocaleDateString()}
              </p>
            </div>
            {rfq.createdBy && (
              <div>
                <label className="text-sm text-gray-500">Created By</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {rfq.createdBy.firstName} {rfq.createdBy.lastName}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {rfq.description && (
          <div>
            <label className="text-sm text-gray-500">Description</label>
            <p className="text-sm text-gray-900 mt-2">{rfq.description}</p>
          </div>
        )}

        {/* Items */}
        {rfq.items && rfq.items.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Requested Items</h3>
            <div className="space-y-3">
              {rfq.items.map((item: any, index: any) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.description}</h4>
                      {item.specifications && (
                        <p className="text-sm text-gray-600 mt-1">{item.specifications}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {bidsAreSealed && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <p className="font-medium">Bids are sealed</p>
            <p className="mt-1 text-amber-700">
              Supplier quotations stay hidden until the submission deadline passes or you close this RFQ.
              Use <strong>Close RFQ &amp; Reveal Bids</strong> above once all invited suppliers have responded.
            </p>
          </div>
        )}

        {/* Invited Suppliers */}
        {rfq.invitedSuppliers && rfq.invitedSuppliers.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Invited Suppliers ({rfq.invitedSuppliers.length})
            </h3>
            <div className="space-y-2">
              {rfq.invitedSuppliers.map((invitation: any, index: any) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {invitation.supplier?.companyName || 'Supplier'}
                    </p>
                    {invitation.responded && (
                      <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                        <CheckCircle className="h-3 w-3" />
                        Submitted
                      </span>
                    )}
                  </div>
                  {invitation.quotation && !bidsAreSealed && (
                    <button
                      type="button"
                      onClick={() => navigate(`/app/quotations/${invitation.quotation._id}`)}
                      className="text-sm text-primary hover:underline"
                    >
                      View Quotation
                    </button>
                  )}
                  {invitation.quotation && bidsAreSealed && (
                    <span className="text-xs text-amber-600 font-medium">Bid sealed</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terms & Conditions */}
        {rfq.termsAndConditions && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Terms & Conditions</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{rfq.termsAndConditions}</p>
          </div>
        )}

        {/* Delivery Requirements */}
        {rfq.deliveryRequirements && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delivery Requirements</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{rfq.deliveryRequirements}</p>
          </div>
        )}

        {/* Payment Terms */}
        {rfq.paymentTerms && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Terms</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{rfq.paymentTerms}</p>
          </div>
        )}
      </div>
    </div>
  );
}
