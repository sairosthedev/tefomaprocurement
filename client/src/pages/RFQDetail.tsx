import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { isProcurementHead } from '@fossil/shared';
import PageHeader from '../components/PageHeader';
import EquipmentDetailsView from '../components/EquipmentDetailsView';
import RfqRankingPanel from '../components/RfqRankingPanel';
import InvitedSuppliersList from '../components/InvitedSuppliersList';
import {
  Send,
  Loader2,
  XCircle,
  Split
} from 'lucide-react';

const statusColors: any = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  closed: 'bg-amber-100 text-amber-700',
  evaluating: 'bg-purple-100 text-purple-700',
  awarded: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

/** Where an RFQ's award stands, for the whole-quotation and the split (per-line) paths. */
function awardProgress(rfq: any) {
  const lines: any[] = rfq.lineAwards || [];
  // Opening the award matrix seeds a pending line per item, so lines alone do
  // not make a split award: one must be flagged or actually awarded.
  const split = !!rfq.splitAward || lines.some((l) => l.status && l.status !== 'pending');
  if (split) {
    const awarded = lines.filter((l) => l.status === 'awarded');
    return {
      split,
      selectedId: null as string | null,
      selected: awarded.length > 0,
      authorized: awarded.length > 0 && awarded.every((l) => l.pmAuthorization?.by),
      done: awarded.length > 0 && awarded.every((l) => l.poGenerated),
      detail: lines.length ? `${awarded.length}/${lines.length} lines` : undefined
    };
  }
  const selectedId = rfq.hodSelection?.quotation || rfq.pmAuthorization?.quotation || null;
  return {
    split,
    selectedId: selectedId ? String(selectedId._id || selectedId) : null,
    selected: !!selectedId,
    authorized: !!rfq.pmAuthorization?.quotation,
    // acceptQuotation moves the RFQ to 'awarded'.
    done: rfq.status === 'awarded',
    detail: undefined as string | undefined
  };
}


export default function RFQDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const procurementHead = isProcurementHead(user);
  const rankingRef = useRef<HTMLDivElement>(null);
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

  const invitedCount = rfq.invitedSuppliers?.length || 0;
  const itemCount = rfq.items?.length || 0;
  // The number and status are in the header already; these are the rest of the
  // RFQ at a glance.
  const facts: Array<{ label: string; value: React.ReactNode; sub?: string }> = [
    {
      label: 'Submission deadline',
      value: rfq.submissionDeadline ? new Date(rfq.submissionDeadline).toLocaleDateString('en-ZA') : '—'
    },
    ...(rfq.createdBy
      ? [{ label: 'Created by', value: `${rfq.createdBy.firstName} ${rfq.createdBy.lastName}` }]
      : []),
    { label: 'Items', value: `${itemCount} ${itemCount === 1 ? 'item' : 'items'}` },
    { label: 'Suppliers invited', value: `${invitedCount} ${invitedCount === 1 ? 'supplier' : 'suppliers'}` }
  ];

  return (
    <div className="p-8">
      <PageHeader
        backTo="/app/rfqs"
        backLabel="Back to RFQs"
        title={rfq.title}
        subtitle={`#${rfq.rfqNumber}`}
        bottomSpacing="mb-4"
        actions={
          <>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[rfq.status]}`}>
              {rfq.status?.charAt(0).toUpperCase() + rfq.status?.slice(1)}
            </span>
            {rfq.status === 'draft' && (
              <button
                onClick={handlePublish}
                disabled={(rfq.items || []).filter((item: any) => item.description?.trim()).length === 0}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
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
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Close RFQ & Reveal Bids
              </button>
            )}
            {['closed', 'evaluating', 'awarded'].includes(rfq.status) && (
              <button
                onClick={() => navigate(`/app/rfqs/${rfq._id}/award`)}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                title="Award each line to the best supplier (split across suppliers)"
              >
                <Split className="h-4 w-4" />
                Split Award
              </button>
            )}
          </>
        }
      />

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-5">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 px-5 py-4">
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

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
        {/* Description */}
        {rfq.description && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{rfq.description}</p>
          </div>
        )}

        {/* Items */}
        {rfq.items && rfq.items.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Requested items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap w-10">#</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Description</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Quantity</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {rfq.items.map((item: any, index: any) => (
                    <tr key={index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-500 align-top">{index + 1}</td>
                      <td className="py-2 px-3 border-b border-gray-100 align-top">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        {item.specifications && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.specifications}</p>
                        )}
                        <EquipmentDetailsView
                          equipment={item.equipment}
                          attachments={item.attachments}
                          compact
                        />
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right font-medium text-gray-900 align-top">{item.quantity}</td>
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-600 align-top">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

        {/* Ranked responses. Above the invitation list on purpose: once bids are
            in, how they compare matters more than who was asked. */}
        {!bidsAreSealed && ['closed', 'evaluating', 'awarded'].includes(rfq.status) && (
          <div ref={rankingRef} className="scroll-mt-6">
            <RfqRankingPanel
              rfqId={rfq._id}
              refreshKey={rfq.status}
              onViewQuotation={(quotationId) => navigate(`/app/quotations/${quotationId}`)}
            />
          </div>
        )}

        {/* Invited Suppliers */}
        {rfq.invitedSuppliers && rfq.invitedSuppliers.length > 0 && (
          <InvitedSuppliersList
            invitations={rfq.invitedSuppliers}
            bidsAreSealed={bidsAreSealed}
            onViewQuotation={(quotationId) => navigate(`/app/quotations/${quotationId}`)}
          />
        )}

        {/* Terms & Conditions */}
        {rfq.termsAndConditions && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Terms & Conditions</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{rfq.termsAndConditions}</p>
          </div>
        )}

        {/* Delivery Requirements */}
        {rfq.deliveryRequirements && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Delivery Requirements</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{rfq.deliveryRequirements}</p>
          </div>
        )}

        {/* Payment Terms */}
        {rfq.paymentTerms && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Payment Terms</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{rfq.paymentTerms}</p>
          </div>
        )}
      </div>
    </div>
  );
}
