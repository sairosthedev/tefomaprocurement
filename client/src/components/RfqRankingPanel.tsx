import React, { useEffect, useState } from 'react';
import { procurementAPI } from '../lib/api';
import {
  Trophy,
  Loader2,
  AlertTriangle,
  Lock,
  Clock,
  TrendingDown,
  Info,
  ShieldAlert
} from 'lucide-react';

/**
 * Ranked responses to an RFQ, supplier against supplier.
 *
 * The score is advisory and labelled as such wherever it appears: the award is
 * still a justified procurement selection followed by PM
 * authorization. The point of showing the
 * breakdown rather than just the winner is that the officer has to justify
 * whichever response they pick, and they should not have to reconstruct the
 * arithmetic to do it.
 */

interface Props {
  rfqId: string;
  /** Re-fetch when the parent reloads the RFQ (e.g. after closing it). */
  refreshKey?: any;
  onViewQuotation?: (quotationId: string) => void;
}

const barColour = (key: string): string =>
  ({
    price: 'bg-blue-500',
    delivery: 'bg-emerald-500',
    performance: 'bg-violet-500',
    completeness: 'bg-amber-500'
  } as Record<string, string>)[key] || 'bg-gray-400';

export default function RfqRankingPanel({ rfqId, refreshKey, onViewQuotation }: Props) {
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await procurementAPI.getRfqRanking(rfqId);
        if (!cancelled && res.data.success) setRanking(res.data.data);
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load the ranking');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => {
      cancelled = true;
    };
  }, [rfqId, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ranking responses…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!ranking) return null;

  // Sealed bids: the ranking is a view of every bid at once, so it honours the
  // same seal the individual quotations do.
  if (ranking.sealed) {
    return (
      <div>
        <SectionHeading />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex gap-3">
          <Lock className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Ranking is sealed until bids are revealed</p>
            <p className="mt-1 text-amber-700">
              {ranking.respondedCount} of {ranking.invitedCount} invited suppliers have responded.
              Ranking becomes available when the submission deadline passes or you close the RFQ.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!ranking.responses?.length) {
    return (
      <div>
        <SectionHeading />
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
          No responses to rank yet — {ranking.invitedCount} supplier
          {ranking.invitedCount === 1 ? ' was' : 's were'} invited.
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading />

      {/* Mixed currency: nothing is scored, and the reason is stated outright.
          A confidently wrong ranking is worse than none. */}
      {ranking.mixedCurrency && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Responses cannot be ranked</p>
            <p className="mt-1 text-red-700">
              Bids arrived in {ranking.currencies.join(' and ')}. The system holds no exchange rates,
              so comparing these totals would be misleading. Convert them outside the system, or ask
              suppliers to requote in one currency.
            </p>
          </div>
        </div>
      )}

      {!ranking.mixedCurrency && (
        <div className="mb-4 flex flex-wrap gap-4 text-sm text-gray-600">
          <span>
            <strong className="text-gray-900">{ranking.respondedCount}</strong> of{' '}
            {ranking.invitedCount} invited responded
          </span>
          {ranking.lowestTotal !== undefined && (
            <span className="flex items-center gap-1">
              <TrendingDown className="h-4 w-4 text-emerald-600" />
              Lowest: {ranking.currencies[0]} {ranking.lowestTotal.toLocaleString()}
            </span>
          )}
          {ranking.spreadPercent ? <span>Spread: {ranking.spreadPercent}%</span> : null}
        </div>
      )}

      <div className="space-y-3">
        {ranking.responses.map((r: any) => {
          const isOpen = Boolean(expanded[r.quotationId]);
          return (
            <div
              key={r.quotationId}
              className={`border rounded-xl overflow-hidden ${
                r.recommended ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`flex-shrink-0 h-8 w-8 rounded-full grid place-items-center text-sm font-semibold ${
                        r.rank === 1 && !ranking.mixedCurrency
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {ranking.mixedCurrency ? '—' : r.rank}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 truncate">
                          {r.supplierName || r.quotationNumber}
                        </p>
                        {r.recommended && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-medium">
                            <Trophy className="h-3 w-3" /> Recommended
                          </span>
                        )}
                        {r.isLowest && !ranking.mixedCurrency && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                            Lowest price
                          </span>
                        )}
                        {r.isFastest && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                            Fastest delivery
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.quotationNumber}
                        {' · '}
                        {r.linesQuoted}/{r.lineCount} lines priced
                        {r.alternativeLines > 0 && ` · ${r.alternativeLines} equivalent part(s)`}
                        {typeof r.deliveryPeriod === 'number' && ` · ${r.deliveryPeriod} day delivery`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">
                      {r.currency} {r.totalAmount.toLocaleString()}
                    </p>
                    {!ranking.mixedCurrency && (
                      <>
                        <p className="text-xs text-gray-500">
                          {r.percentAboveLowest > 0 ? `+${r.percentAboveLowest}% vs lowest` : '—'}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {r.score}
                          <span className="text-xs font-normal text-gray-500">/100</span>
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Score breakdown — the arithmetic, so the choice is defensible. */}
                {!ranking.mixedCurrency && (
                  <>
                    <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-gray-100">
                      {r.scores.map((s: any) => (
                        <div
                          key={s.key}
                          className={barColour(s.key)}
                          style={{ width: `${s.weighted}%` }}
                          title={`${s.label}: ${s.weighted} of ${s.weight} points`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [r.quotationId]: !isOpen }))
                      }
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      {isOpen ? 'Hide score breakdown' : 'Show score breakdown'}
                    </button>

                    {isOpen && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {r.scores.map((s: any) => (
                          <div
                            key={s.key}
                            className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2"
                          >
                            <span className="flex items-center gap-1.5 text-gray-700">
                              <span className={`h-2 w-2 rounded-full ${barColour(s.key)}`} />
                              {s.label}
                              {s.assumed && (
                                <span
                                  title="No evaluation history for this supplier — a neutral default was applied rather than a zero."
                                  className="text-amber-600"
                                >
                                  <Info className="h-3 w-3" />
                                </span>
                              )}
                            </span>
                            <span className="font-medium text-gray-900">
                              {s.weighted}
                              <span className="text-gray-400"> / {s.weight}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {r.recommended && r.recommendationReason && (
                  <p className="mt-3 text-xs text-emerald-800 bg-emerald-100/60 rounded-lg px-3 py-2">
                    {r.recommendationReason}
                  </p>
                )}

                {r.disqualifiers?.map((d: string, i: number) => (
                  <p
                    key={i}
                    className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2"
                  >
                    {d.includes('eligible') || d.includes('KYS') ? (
                      <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{d}</span>
                  </p>
                ))}

                {onViewQuotation && (
                  <button
                    type="button"
                    onClick={() => onViewQuotation(r.quotationId)}
                    className="mt-3 text-sm text-primary hover:underline"
                  >
                    View quotation
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!ranking.mixedCurrency && (
        <p className="mt-3 text-xs text-gray-500">
          Weighting:{' '}
          {ranking.weights?.map((w: any, i: number) => (
            <span key={w.key} title={w.description}>
              {i > 0 && ' · '}
              {w.label} {w.weight}%
            </span>
          ))}
          . Advisory only — the award still needs department-head selection and Procurement Manager
          authorisation.
        </p>
      )}
    </div>
  );
}

function SectionHeading() {
  return (
    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <Trophy className="h-5 w-5" />
      Response Ranking
    </h3>
  );
}
