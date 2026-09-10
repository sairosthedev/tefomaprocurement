import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { Loader2, CheckCircle, Circle, ShieldCheck, DollarSign, Package, RefreshCw, Send, Sparkles, AlertTriangle } from 'lucide-react';

const WAIVER_TYPES = [
  { value: 'single_source', label: 'Single/sole source' },
  { value: 'no_quotes', label: 'Insufficient quotations' },
  { value: 'unique_product', label: 'Unique / proprietary' },
  { value: 'custom_manufacture', label: 'Custom manufacture' },
  { value: 'other', label: 'Other' }
];

export default function AwardMatrix() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);

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

  const selectLine = (line: any, bid: any) => {
    // Make the benchmark explicit in the prompt: an award above the lowest bid
    // is exactly the case an auditor will want the justification to address.
    const context = bid.isLowest
      ? ' (lowest bid)'
      : bid.percentAboveLowest
      ? ` (+${bid.percentAboveLowest}% above the lowest bid of ${line.lowestUnitPrice})`
      : '';
    const justification = window.prompt(
      `Justification for awarding "${line.description}" to ${bid.supplierName} at ${bid.unitPrice}${context}:`
    );
    if (!justification?.trim()) return;
    act(
      () => procurementAPI.hodSelectLine(id, {
        rfqLineId: line.rfqLineId, quotationId: bid.quotationId, supplierId: bid.supplierId,
        unitPrice: bid.unitPrice, justification
      }),
      'Line awarded (HOD selection recorded)'
    );
  };

  const authorizeLine = (line: any) =>
    act(() => procurementAPI.pmAuthorizeLine(id, { rfqLineId: line.rfqLineId }), 'Line authorized');

  const waiveLine = (line: any) => {
    const reason = window.prompt(`Waiver reason for "${line.description}" (fewer than 3 quotes):`);
    if (!reason?.trim()) return;
    act(
      () => procurementAPI.waiveLine(id, { rfqLineId: line.rfqLineId, reason, waiverType: 'single_source' }),
      'Line waiver approved'
    );
  };

  const generatePOs = () =>
    act(
      () => procurementAPI.generateLineAwardPOs(id, { expectedDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString() }),
      'Purchase orders generated'
    );

  const resource = () =>
    act(() => procurementAPI.resourceUnawardedLines(id, {}), 'Unresolved lines re-sourced into a new RFQ');

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!data) return null;

  const lines: any[] = data.lines || [];
  // Distinct suppliers across all bids for the comparison columns.
  const suppliers = Array.from(
    new Map(lines.flatMap((l) => l.bids).map((b: any) => [b.supplierId, b.supplierName || b.supplierId])).entries()
  ).map(([supplierId, name]) => ({ supplierId, name }));

  const anyAwarded = lines.some((l) => l.status === 'awarded' && l.fullyAuthorized && !l.poGenerated);
  const anyUnresolved = lines.some((l) => !l.poGenerated && l.status !== 'awarded');

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        backTo={`/app/rfqs/${id}`}
        backLabel="Back to RFQ"
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Line</th>
              {suppliers.map((s) => (
                <th key={s.supplierId} className="text-right py-3 px-4 font-semibold text-gray-700">{s.name}</th>
              ))}
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const awardedTo = line.awardedSupplier ? String(line.awardedSupplier) : null;
              return (
                <tr key={String(line.rfqLineId)} className="border-b border-gray-100">
                  <td className="py-3 px-4">
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
                      <td key={s.supplierId} className="text-right py-3 px-4">
                        {bid ? (
                          <button
                            disabled={busy || line.poGenerated}
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
                            {bid.unitPrice}
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
                  <td className="text-center py-3 px-4">
                    <StatusPill line={line} />
                  </td>
                  <td className="text-right py-3 px-4 whitespace-nowrap">
                    {line.status === 'awarded' && !line.pmAuthorization?.by && (
                      <button disabled={busy} onClick={() => authorizeLine(line)}
                        className="inline-flex items-center gap-1 text-xs bg-primary text-white px-2.5 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50">
                        <ShieldCheck className="h-3.5 w-3.5" /> Authorize
                      </button>
                    )}
                    {line.bidCount > 0 && line.bidCount < 3 && !line.waiver?.waived && (
                      <button disabled={busy} onClick={() => waiveLine(line)}
                        className="ml-2 inline-flex items-center gap-1 text-xs bg-amber-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-amber-600 disabled:opacity-50">
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

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button disabled={busy || !anyAwarded} onClick={generatePOs}
          className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Generate POs for authorized lines
        </button>
        <button disabled={busy || !anyUnresolved} onClick={resource}
          className="inline-flex items-center gap-2 border border-amber-300 text-amber-700 px-4 py-2.5 rounded-xl hover:bg-amber-50 disabled:opacity-50">
          <RefreshCw className="h-4 w-4" />
          Re-source unquoted / unawarded lines
        </button>
        <button onClick={() => navigate('/app/purchase-orders')}
          className="inline-flex items-center gap-2 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-100">
          <Send className="h-4 w-4" /> View purchase orders
        </button>
      </div>
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
