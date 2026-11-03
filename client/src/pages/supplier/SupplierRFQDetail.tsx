import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { Clock, Loader2, PartyPopper, Send } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import FactsCard from '../../components/supplier/FactsCard';
import { SubmitQuotationDrawer } from '../../components/QuotationForm';

export default function SupplierRFQDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rfq, setRfq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // The quotation drawer lives in the URL (?quote=1), so links from elsewhere
  // can open it and the browser's Back button closes it.
  const [searchParams, setSearchParams] = useSearchParams();

  const openQuote = () => {
    setSearchParams((params) => {
      params.set('quote', '1');
      return params;
    });
  };

  const closeQuote = () => {
    setSearchParams(
      (params) => {
        params.delete('quote');
        return params;
      },
      { replace: true }
    );
  };

  const handleQuoted = () => {
    closeQuote();
    // Picks up the submitted (or revised) quote, so the steps and buttons move on.
    loadRfq();
  };

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
  // A stale ?quote=1 link to an RFQ that can no longer be quoted just shows the RFQ.
  const quoteOpen = canSubmit && searchParams.get('quote') === '1';

  return (
    <div className="p-8">
      <PageHeader
        backTo="/app/my-rfqs"
        backLabel="Back to My RFQs"
        title={rfq.title}
        subtitle={rfq.rfqNumber || `RFQ-${String(rfq._id).slice(-6).toUpperCase()}`}
        bottomSpacing="mb-4"
        actions={
          canSubmit ? (
            <button
              onClick={openQuote}
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {rfq.revisionRequested ? 'Submit Revised Quote' : 'Submit Quote'}
            </button>
          ) : undefined
        }
      />

      {rfq.revisionRequested && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
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
        <div className="mb-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <PartyPopper className="h-6 w-6 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-800">Your quotation was accepted</p>
            <p className="text-sm text-emerald-700">Procurement selected your quote for this RFQ.</p>
          </div>
        </div>
      )}

      <FactsCard
        className="mb-5"
        cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7"
        facts={[
          {
            label: 'Submission deadline',
            value: (
              <span className="inline-flex items-center gap-1.5">
                <Clock className={`h-4 w-4 shrink-0 ${remaining.urgent ? 'text-red-500' : 'text-gray-400'}`} />
                {new Date(rfq.submissionDeadline).toLocaleString('en-ZA')}
              </span>
            )
          },
          {
            label: 'Time left',
            value: <span className={remaining.urgent ? 'text-red-600' : ''}>{remaining.text}</span>
          },
          { label: 'Status', value: <span className="capitalize">{rfq.hasSubmitted ? 'Submitted' : rfq.status}</span> }
        ]}
      />

      {/* Description, items and terms */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        {rfq.description && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{rfq.description}</p>
          </div>
        )}

        <div className={rfq.description ? 'border-t border-gray-100 pt-4' : ''}>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Items required</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">#</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Description</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Quantity</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Specification</th>
                </tr>
              </thead>
              <tbody>
                {rfq.items?.map((item: any, index: number) => (
                  <tr key={index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                    <td className="py-2 px-3 border-b border-gray-100">{index + 1}</td>
                    <td className="py-2 px-3 border-b border-gray-100 font-medium">{item.description}</td>
                    <td className="py-2 px-3 border-b border-gray-100">{item.quantity} {item.unit}</td>
                    <td className="py-2 px-3 border-b border-gray-100 text-gray-500">{item.specification || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {rfq.termsAndConditions && (
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Terms & conditions</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{rfq.termsAndConditions}</p>
          </div>
        )}
      </div>

      <SubmitQuotationDrawer
        isOpen={quoteOpen}
        rfqId={rfq._id}
        rfq={rfq}
        onClose={closeQuote}
        onSaved={handleQuoted}
      />
    </div>
  );
}
