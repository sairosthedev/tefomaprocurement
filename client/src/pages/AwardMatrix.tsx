import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { TEXT_LIMITS, isProcurementHead, validateLineSelection, validateLineWaiver } from '@fossil/shared';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import Modal from '../components/Modal';
import FieldError from '../components/FieldError';
import { usePrompt } from '../components/PromptModal';
import { useFormValidation } from '../lib/useFormValidation';
import { Loader2, CheckCircle, Circle, ShieldCheck, DollarSign, Package, RefreshCw, Send, Sparkles, AlertTriangle, Clock } from 'lucide-react';

const bidPrice = (amount: number, currency?: string) =>
  formatCurrency(amount, currency || getCurrentSbuCurrency());

/** Reasons for waiving the three-quote rule on a line, as on QuotationDetail.
 *  Values must match the RFQ waiverType enum on the API. */
const WAIVER_TYPES: { value: string; label: string }[] = [
  { value: 'single_source', label: 'Single/sole source — only one capable supplier' },
  { value: 'no_quotes', label: 'Insufficient quotations received' },
  { value: 'service_agreement', label: 'Existing service agreement' },
  { value: 'approved_contract', label: 'Approved framework / contract' },
  { value: 'unique_product', label: 'Unique / proprietary product' },
  { value: 'custom_manufacture', label: 'Custom manufacture / bespoke item' },
  { value: 'coo_directed', label: 'COO directed procurement' },
  { value: 'coo_instruction', label: 'COO written instruction' },
  { value: 'other', label: 'Other (state reason below)' }
];

export default function AwardMatrix() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  // Officers select; only the Head of Procurement authorizes what they selected.
  const canSelect = user?.role === 'procurement_officer' || isProcurementHead(user);
  const canAuthorize = isProcurementHead(user);
  // Waiving the three-quote rule is the COO's or the Head of Procurement's.
  const canWaive = user?.role === 'coo' || isProcurementHead(user);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  // The line whose waiver is being approved, with the chosen type and reason.
  const [waiverLine, setWaiverLine] = useState<any>(null);
  const [waiverType, setWaiverType] = useState('');
  const [waiverReason, setWaiverReason] = useState('');
  const waiverForm = useFormValidation(validateLineWaiver, {
    rfqLineId: waiverLine?.rfqLineId,
    waiverType,
    reason: waiverReason
  });
  // Asks for the justification when a line is awarded.
  const { ask, promptElement } = usePrompt();

  const load = async () => {
    try {
      setLoading(true);
      const res = await procurementAPI.getLineAwards(id);
      setData(res.data.data);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Failed to load award matrix', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    try {
      setBusy(true);
      await fn();
      showToast(okMsg, 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectLine = async (line: any, bid: any) => {
    // Make the benchmark explicit in the prompt: an award above the lowest bid
    // is exactly the case an auditor will want the justification to address.
    const context = bid.isLowest
      ? ' (lowest bid)'
      : bid.percentAboveLowest
      ? ` (+${bid.percentAboveLowest}% above the lowest bid of ${bidPrice(line.lowestUnitPrice, bid.currency)})`
      : '';
    // The API's own check on the award, so the prompt says what the API would.
    const justificationProblem = (justification: string) =>
      validateLineSelection({ rfqLineId: line.rfqLineId, quotationId: bid.quotationId, justification }).justification || '';
    const answer = await ask({
      title: 'Award this line',
      subtitle: line.description,
      message: `Award "${line.description}" to ${bid.supplierName} at ${bidPrice(bid.unitPrice, bid.currency)}${context}.`,
      fields: [
        {
          name: 'justification',
          label: 'Justification',
          multiline: true,
          placeholder: 'Why this supplier, at this price',
          requiredMessage: justificationProblem(''),
          // The shared check sets the length limit, in its own words.
          maxLength: Number.POSITIVE_INFINITY,
          validate: justificationProblem
        }
      ],
      confirmLabel: 'Award line'
    });
    if (!answer) return;
    act(
      () => procurementAPI.selectLine(id, {
        rfqLineId: line.rfqLineId, quotationId: bid.quotationId, supplierId: bid.supplierId,
        unitPrice: bid.unitPrice, justification: answer.justification
      }),
      'Line awarded (selection recorded)'
    );
  };

  const authorizeLine = (line: any) =>
    act(() => procurementAPI.pmAuthorizeLine(id, { rfqLineId: line.rfqLineId }), 'Line authorized');

  const waiveLine = (line: any) => {
    setWaiverType('');
    setWaiverReason('');
    waiverForm.reset();
    setWaiverLine(line);
  };

  const submitWaiver = async () => {
    if (!waiverLine || !waiverForm.check()) return;
    try {
      setBusy(true);
      await procurementAPI.waiveLine(id, {
        rfqLineId: waiverLine.rfqLineId,
        reason: waiverReason.trim(),
        waiverType
      });
      showToast('Line waiver approved', 'success');
      // Closed only once it is approved, so a refusal leaves the entry to correct.
      setWaiverLine(null);
      await load();
    } catch (e: any) {
      if (!waiverForm.fromServer(e)) showToast(e.response?.data?.message || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  // The new orders are submitted for approval from their own pages, so go
  // there: straight to the order when there is one, else to the list.
  const generatePOs = async () => {
    try {
      setBusy(true);
      const res = await procurementAPI.generateLineAwardPOs(id, {
        expectedDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString()
      });
      showToast(res.data?.message || 'Purchase orders generated', 'success');
      const created: any[] = res.data?.data?.purchaseOrders || [];
      navigate(created.length === 1 && created[0]?._id ? `/app/purchase-orders/${created[0]._id}` : '/app/purchase-orders');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const resource = () =>
    act(() => procurementAPI.resourceUnawardedLines(id, {}), 'Unresolved lines re-sourced into a new RFQ');

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!data) return null;

  // While bids are sealed the API sends the lines without any bids, so there is
  // nothing to compare or award yet.
  if (data.sealed) {
    return (
      <div className="p-8 max-w-2xl">
        <PageHeader
          backTo={canSelect ? `/app/rfqs/${id}` : '/app'}
          backLabel={canSelect ? 'Back to RFQ' : 'Back to Dashboard'}
          title="Split Award — line by line"
        />
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-sm text-amber-800 mb-2">
            Bids are sealed until the submission deadline passes or the RFQ is closed.
          </p>
          {data.submissionDeadline && (
            <p className="text-sm text-gray-600">
              {data.rfqNumber && <><span className="font-mono font-medium">{data.rfqNumber}</span> · </>}
              Deadline: {new Date(data.submissionDeadline).toLocaleString('en-ZA')}
            </p>
          )}
        </div>
      </div>
    );
  }

  const lines: any[] = data.lines || [];
  // Distinct suppliers across all bids for the comparison columns.
  const suppliers = Array.from(
    new Map(lines.flatMap((l) => l.bids).map((b: any) => [b.supplierId, b.supplierName || b.supplierId])).entries()
  ).map(([supplierId, name]) => ({ supplierId, name }));

  const anyAwarded = lines.some((l) => l.status === 'awarded' && l.fullyAuthorized && !l.poGenerated);
  const anyUnresolved = lines.some((l) => !l.poGenerated && l.status !== 'awarded');

  // Lines with at least one bid are the ones that can be awarded here; unquoted
  // lines are re-sourced instead.
  const quotedLines = lines.filter((l) => l.status !== 'unquoted');
  const awardedLines = lines.filter((l) => l.status === 'awarded');
  const authorizedLines = awardedLines.filter((l) => l.fullyAuthorized || l.pmAuthorization?.by);
  const poLines = awardedLines.filter((l) => l.poGenerated);
  const pendingAuth = awardedLines.length - authorizedLines.length;
  const unawarded = quotedLines.length - awardedLines.length;

  return (
    <div className="p-8">
      {/* The COO is here only for line waivers and cannot open the RFQ. */}
      <PageHeader
        backTo={canSelect ? `/app/rfqs/${id}` : '/app'}
        backLabel={canSelect ? 'Back to RFQ' : 'Back to Dashboard'}
        title="Split Award — line by line"
        subtitle="Award each line to the best supplier, authorize, then generate a PO per supplier."
      />

      <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Bids are ranked cheapest-first and the highlighted price is the system's
          recommendation (lowest compliant bid, with supplier evaluation scores
          breaking near-ties). It is advisory — you still choose and justify the award.
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Line</th>
              {suppliers.map((s) => (
                <th key={s.supplierId} className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">{s.name}</th>
              ))}
              <th className="text-center py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const awardedTo = line.awardedSupplier ? String(line.awardedSupplier) : null;
              return (
                <tr key={String(line.rfqLineId)} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                  <td className="py-2 px-3 border-b border-gray-100">
                    <p className="font-medium text-gray-900">{line.description}</p>
                    <p className="text-xs text-gray-500">Qty {line.quantity}</p>
                    {line.mixedCurrency ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        Bids in {line.currencies?.join(', ')} — not price-comparable
                      </p>
                    ) : (
                      line.bidCount > 1 && (
                        <p className="mt-1 text-[11px] text-gray-400">
                          {line.bidCount} bids · {line.spreadPercent}% spread
                        </p>
                      )
                    )}
                  </td>
                  {suppliers.map((s) => {
                    const bid = line.bids.find((b: any) => b.supplierId === s.supplierId);
                    const isAwarded = awardedTo === s.supplierId;
                    return (
                      <td key={s.supplierId} className="text-right py-2 px-3 border-b border-gray-100">
                        {bid && !canSelect ? (
                          <span className={isAwarded ? 'px-2 py-1 rounded-lg bg-green-100 text-green-800 font-semibold' : 'px-2 py-1 text-gray-800'}>
                            {bidPrice(bid.unitPrice, bid.currency)}
                            {isAwarded && <CheckCircle className="inline h-3.5 w-3.5 ml-1" />}
                          </span>
                        ) : bid ? (
                          <button
                            disabled={busy || line.poGenerated || Boolean(line.pmAuthorization?.by)}
                            onClick={() => selectLine(line, bid)}
                            className={`px-2 py-1 rounded-lg ${
                              isAwarded
                                ? 'bg-green-100 text-green-800 font-semibold'
                                : bid.recommended
                                ? 'bg-amber-50 ring-1 ring-amber-300 text-amber-900 font-medium hover:bg-amber-100'
                                : 'hover:bg-primary/10 text-gray-800'
                            } disabled:opacity-50`}
                            title={
                              isAwarded
                                ? 'Awarded'
                                : bid.recommendationReason || 'Award this line to this supplier'
                            }
                          >
                            {bid.recommended && !isAwarded && (
                              <Sparkles className="inline h-3 w-3 mr-1 text-amber-600" />
                            )}
                            {bidPrice(bid.unitPrice, bid.currency)}
                            {!bid.notComparable && !bid.isLowest && bid.percentAboveLowest > 0 && (
                              <span className="ml-1 text-[10px] text-gray-500">
                                +{bid.percentAboveLowest}%
                              </span>
                            )}
                            {isAwarded && <CheckCircle className="inline h-3.5 w-3.5 ml-1" />}
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center py-2 px-3 border-b border-gray-100">
                    <StatusPill line={line} />
                  </td>
                  <td className="text-right py-2 px-3 border-b border-gray-100 whitespace-nowrap">
                    {line.status === 'awarded' && !line.pmAuthorization?.by && !canAuthorize && (
                      <span className="text-xs text-amber-600">Awaiting Head of Procurement</span>
                    )}
                    {line.status === 'awarded' && !line.pmAuthorization?.by && canAuthorize && (
                      <button disabled={busy} onClick={() => authorizeLine(line)}
                        className="inline-flex items-center gap-1 text-xs bg-primary text-white px-2.5 py-1.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
                        <ShieldCheck className="h-3.5 w-3.5" /> Authorize
                      </button>
                    )}
                    {canWaive && line.bidCount > 0 && line.bidCount < 3 && !line.waiver?.waived && (
                      <button disabled={busy} onClick={() => waiveLine(line)}
                        className="ml-2 inline-flex items-center gap-1 text-xs bg-primary text-white px-2.5 py-1.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
                        <DollarSign className="h-3.5 w-3.5" /> Waiver
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canSelect && (
        <div className="flex flex-wrap items-center gap-3 mt-6">
          <button disabled={busy || !anyAwarded} onClick={generatePOs}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            Generate POs for authorized lines
          </button>
          <button disabled={busy || !anyUnresolved} onClick={resource}
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
            <RefreshCw className="h-4 w-4" />
            Re-source unquoted / unawarded lines
          </button>
          <button onClick={() => navigate('/app/purchase-orders')}
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            <Send className="h-4 w-4" /> View purchase orders
          </button>
        </div>
      )}

      <Modal
        isOpen={!!waiverLine}
        onClose={() => !busy && setWaiverLine(null)}
        title="Approve line waiver"
        subtitle={waiverLine ? `${waiverLine.description} — fewer than 3 quotes` : undefined}
        footer={
          <>
            <button
              type="button"
              onClick={() => setWaiverLine(null)}
              disabled={busy}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitWaiver}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Approve waiver
            </button>
          </>
        }
      >
        <div ref={waiverForm.formRef} className="space-y-3">
          <div>
            <select
              value={waiverType}
              onChange={(e: any) => setWaiverType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...waiverForm.invalid('waiverType')}
            >
              <option value="">Select waiver type…</option>
              {WAIVER_TYPES.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
            <FieldError message={waiverForm.errors.waiverType} />
          </div>
          <div>
            <textarea
              value={waiverReason}
              onChange={(e: any) => setWaiverReason(e.target.value)}
              rows={3}
              placeholder="Justification for waiving the 3-quotation requirement on this line..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              maxLength={TEXT_LIMITS.long}
              {...waiverForm.invalid('reason')}
            />
            <FieldError message={waiverForm.errors.reason || waiverForm.errors.rfqLineId} />
          </div>
        </div>
      </Modal>
      {promptElement}
    </div>
  );
}

function StatusPill({ line }: { line: any }) {
  if (line.poGenerated) return <Pill color="emerald" icon={<CheckCircle className="h-3.5 w-3.5" />} text="PO created" />;
  if (line.fullyAuthorized) return <Pill color="green" icon={<CheckCircle className="h-3.5 w-3.5" />} text="Authorized" />;
  if (line.status === 'awarded') return <Pill color="blue" icon={<Circle className="h-3.5 w-3.5" />} text="Awarded (needs auth)" />;
  if (line.status === 'unquoted') return <Pill color="gray" icon={<Circle className="h-3.5 w-3.5" />} text="No quotes" />;
  if (line.status === 'unawarded') return <Pill color="amber" icon={<Circle className="h-3.5 w-3.5" />} text="Unawarded" />;
  return <Pill color="gray" icon={<Circle className="h-3.5 w-3.5" />} text="Pending" />;
}

function Pill({ color, icon, text }: { color: string; icon: any; text: string }) {
  const map: any = {
    emerald: 'bg-emerald-100 text-emerald-700', green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700', amber: 'bg-amber-100 text-amber-700', gray: 'bg-gray-100 text-gray-600'
  };
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${map[color]}`}>{icon}{text}</span>;
}
