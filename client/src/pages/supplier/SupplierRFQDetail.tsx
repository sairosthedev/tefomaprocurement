import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { Clock, Loader2, PartyPopper, Send } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { WorkflowStepper, NextStepCard } from '../../components/WorkflowStepper';
import { supplierRfqJourney, isQuoteDecided } from '../../lib/supplierJourney';

export default function SupplierRFQDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rfq, setRfq] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadRfq();
  }, [id]);

  const loadRfq = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/supplier/rfqs/${id}`);
      if (res.data.success) {
        setRfq(res.data.data);
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load RFQ', 'error');
      navigate('/app/my-rfqs');
    } finally {
      setLoading(false);
    }
  };

  const getRemainingTime = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return { text: 'Closed', urgent: false, canSubmit: false };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return { text: `${days}d ${hours}h remaining`, urgent: days <= 2, canSubmit: true };
    return { text: `${hours}h remaining`, urgent: true, canSubmit: true };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!rfq) return null;

  const remaining = getRemainingTime(rfq.submissionDeadline);
  // A revision request lets the supplier resubmit even after the RFQ has closed
  // and past the original deadline — procurement explicitly re-opened it for them.
  const canSubmit =
    rfq.revisionRequested ||
    (rfq.status === 'open' && !rfq.hasSubmitted && remaining.canSubmit);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        backTo="/app/my-rfqs"
        backLabel="Back to My RFQs"
        title={rfq.title}
        subtitle={rfq.rfqNumber || `RFQ-${String(rfq._id).slice(-6).toUpperCase()}`}
        actions={
          canSubmit ? (
            <button
              onClick={() => navigate(`/app/submit-quotation?rfq=${rfq._id}`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark"
            >
              <Send className="h-4 w-4" />
              {rfq.revisionRequested ? 'Submit Revised Quote' : 'Submit Quote'}
            </button>
          ) : undefined
        }
      />

      {(() => {
        const { steps, stopped } = supplierRfqJourney(rfq, canSubmit);
        const q = rfq.quotationStatus;
        return (
          <>
            <WorkflowStepper steps={steps} />
            {canSubmit ? (
              <NextStepCard
                title={rfq.revisionRequested ? 'Submit your revised quotation' : 'Submit your quotation'}
                description={rfq.revisionRequested ? 'Procurement asked for a revised price.' : `Quotes close on ${new Date(rfq.submissionDeadline).toLocaleString('en-ZA')} (${remaining.text}).`}
                action={{ label: rfq.revisionRequested ? 'Submit revised quote' : 'Submit quote', to: `/app/submit-quotation?rfq=${rfq._id}` }}
              />
            ) : rfq.purchaseOrder ? (
              !rfq.purchaseOrder.isAcknowledged && ['approved', 'issued'].includes(rfq.purchaseOrder.status) ? (
                <NextStepCard
                  title={`Acknowledge purchase order ${rfq.purchaseOrder.poNumber}`}
                  description="Confirm the order and your delivery date, then deliver and invoice against it."
                  action={{ label: 'Open purchase orders', to: '/app/my-purchase-orders' }}
                />
              ) : (
                <NextStepCard
                  title={`Follow purchase order ${rfq.purchaseOrder.poNumber}`}
                  description="Delivery, invoicing and payment for this RFQ continue on the order."
                  action={{ label: 'Open purchase orders', to: '/app/my-purchase-orders' }}
                />
              )
            ) : q === 'accepted' ? (
              <NextStepCard title="Procurement to issue the purchase order" description="It is approved internally before it reaches you." waiting />
            ) : !stopped && q && !isQuoteDecided(q) ? (
              <NextStepCard title="Procurement to evaluate the quotes" description="You are notified when a decision is made." waiting />
            ) : null}
          </>
        );
      })()}

      {rfq.revisionRequested && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Send className="h-6 w-6 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-800">Price revision requested</p>
            <p className="text-sm text-amber-700">
              Procurement has asked you to resubmit with a revised price. Submit a new quote to supersede your previous one.
            </p>
          </div>
        </div>
      )}

      {rfq.quotationStatus === 'accepted' && (
        <div className="mb-6 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <PartyPopper className="h-6 w-6 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-800">Your quotation was accepted</p>
            <p className="text-sm text-emerald-700">Procurement selected your quote for this RFQ.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Submission deadline</p>
            <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
              <Clock className={`h-4 w-4 ${remaining.urgent ? 'text-red-500' : 'text-gray-400'}`} />
              {new Date(rfq.submissionDeadline).toLocaleString('en-ZA')}
            </p>
            <p className={`text-sm mt-1 ${remaining.urgent ? 'text-red-600' : 'text-gray-500'}`}>
              {remaining.text}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-medium text-gray-900 mt-1 capitalize">
              {rfq.hasSubmitted ? 'Submitted' : rfq.status}
            </p>
          </div>
        </div>

        {rfq.description && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Description</p>
            <p className="text-gray-900 whitespace-pre-wrap">{rfq.description}</p>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Items required</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">#</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Description</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Quantity</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Specification</th>
                </tr>
              </thead>
              <tbody>
                {rfq.items?.map((item: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-2 px-3 border border-gray-200">{index + 1}</td>
                    <td className="py-2 px-3 border border-gray-200 font-medium">{item.description}</td>
                    <td className="py-2 px-3 border border-gray-200">{item.quantity} {item.unit}</td>
                    <td className="py-2 px-3 border border-gray-200 text-gray-500">{item.specification || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {rfq.termsAndConditions && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Terms & conditions</p>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{rfq.termsAndConditions}</p>
          </div>
        )}
      </div>
    </div>
  );
}
