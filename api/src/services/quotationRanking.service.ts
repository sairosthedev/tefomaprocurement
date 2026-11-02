import { Quotation, QuotationEvaluation } from '../models/index.js';
import type { IRFQ } from '../models/RFQ.model.js';
import { getSupplierPerformanceScores } from './bidRanking.service.js';
import { checkSupplierEligibility } from './supplierEligibility.service.js';
import {
  DEFAULT_RANKING_WEIGHTS,
  UNRATED_SUPPLIER_PERFORMANCE,
  RANKING_TIE_BAND,
  type RankingCriterionWeight
} from '@fossil/shared';

/**
 * Weighted multi-criteria ranking of the responses to one RFQ.
 *
 * This ranks whole responses, supplier against supplier. It is the companion to
 * bidRanking.service, which ranks bids line by line for a split award — use
 * that when the RFQ will be awarded per line, and this when one supplier is to
 * take the whole thing.
 *
 * Nothing here awards anything. It produces a rank, a score breakdown and a
 * stated reason so the officer has a defensible benchmark; a justified selection
 * and PM authorization still follow.
 *
 * Two refusals are deliberate, because a confidently wrong ranking is worse
 * than none:
 *   - Responses in more than one currency are not scored at all. The system
 *     holds no exchange rates, so comparing them would silently crown the wrong
 *     supplier.
 *   - A response that did not price every line is ranked but never recommended.
 *     It cannot be awarded whole, which is what this ranking is for.
 */

const idStr = (v: any): string => (v?._id ? v._id.toString() : v?.toString?.() ?? '');
const norm = (s: string) => (s || '').toLowerCase().trim();
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Statuses that represent a live response. Superseded quotes are replaced by a
 *  revision and must not be ranked alongside the revision that replaced them. */
const LIVE_QUOTATION_STATUSES = ['submitted', 'under_review', 'accepted'];

export interface RankedCriterionScore {
  key: RankingCriterionWeight['key'];
  label: string;
  weight: number;
  /** Normalised 0-1 performance on this criterion. */
  normalised: number;
  /** normalised * weight — what this criterion contributed to the total. */
  weighted: number;
  /** Set when the figure is an assumption rather than a measurement. */
  assumed?: boolean;
}

export interface RankedResponse {
  rank: number;
  quotationId: string;
  quotationNumber?: string;
  supplierId: string;
  supplierName?: string;

  totalAmount: number;
  currency: string;
  deliveryPeriod?: number;
  validUntil?: Date;

  /** Weighted total out of 100. */
  score: number;
  scores: RankedCriterionScore[];

  /** How far above the cheapest response, as a percentage (0 for the cheapest). */
  percentAboveLowest: number;
  isLowest: boolean;
  isFastest: boolean;

  /** Lines priced, out of the RFQ's line count. */
  linesQuoted: number;
  lineCount: number;
  /** True when the supplier priced every line. */
  isComplete: boolean;
  /** Lines where the supplier offered an equivalent rather than the exact part. */
  alternativeLines: number;

  recommended: boolean;
  /** Why this response was recommended — shown to the approver, and audited. */
  recommendationReason?: string;
  /** Reasons this response cannot be recommended, if any. Shown as warnings. */
  disqualifiers: string[];

  /** Set when the quote's validity has lapsed. */
  expired: boolean;
  /** Set when the supplier could be invited but cannot yet be awarded (KYS). */
  notAwardable: boolean;
  notAwardableReason?: string;
}

export interface RfqRanking {
  rfqId: string;
  rfqNumber?: string;
  responses: RankedResponse[];
  invitedCount: number;
  respondedCount: number;
  lineCount: number;
  weights: readonly RankingCriterionWeight[];

  lowestTotal?: number;
  spreadPercent?: number;

  /** True when responses arrived in more than one currency: totals are NOT
   *  comparable and nothing is scored or recommended. */
  mixedCurrency: boolean;
  currencies: string[];

  recommendedQuotationId?: string;
}

/**
 * Rank every live response to an RFQ.
 *
 * `rfq` must have its `items` loaded. Supplier eligibility is checked at the
 * `award` stage, not `invite`, because the question this ranking answers is who
 * could actually be given the work.
 */
export async function rankRfqResponses(
  rfq: IRFQ,
  weights: readonly RankingCriterionWeight[] = DEFAULT_RANKING_WEIGHTS
): Promise<RfqRanking> {
  const quotes = await Quotation.find({
    rfq: rfq._id,
    isDeleted: false,
    status: { $in: LIVE_QUOTATION_STATUSES }
  }).populate(
    'supplier',
    'companyName status kysComplete kysExempt isDeleted transactability expiredDocumentTypes'
  );

  const performance = await getSupplierPerformanceScores(
    Array.from(new Set(quotes.map((q: any) => idStr(q.supplier))))
  );

  return scoreResponses(rfq, quotes, performance, weights);
}

/**
 * The scoring itself, with the data already loaded.
 *
 * Separated from the fetch so the arithmetic can be exercised against fixtures
 * without a database — the weights decide who wins public money, so they are
 * worth being able to test directly.
 */
export function scoreResponses(
  rfq: IRFQ,
  quotes: any[],
  performance: Map<string, number>,
  weights: readonly RankingCriterionWeight[] = DEFAULT_RANKING_WEIGHTS
): RfqRanking {
  const lineCount = (rfq.items as any[])?.length || 0;
  const invitedCount = (rfq.invitedSuppliers as any[])?.length || 0;

  const base: RfqRanking = {
    rfqId: idStr(rfq._id),
    rfqNumber: (rfq as any).rfqNumber,
    responses: [],
    invitedCount,
    respondedCount: quotes.length,
    lineCount,
    weights,
    mixedCurrency: false,
    currencies: []
  };

  if (quotes.length === 0) return base;

  const currencies = Array.from(new Set(quotes.map((q: any) => q.currency || 'USD')));
  base.currencies = currencies;

  // Facts that do not depend on comparability, gathered first so an unscorable
  // ranking can still show the officer what arrived.
  const rows = quotes.map((q: any) => {
    const coverage = lineCoverage(rfq, q);
    const eligibility = checkSupplierEligibility(q.supplier, 'award');
    const validUntil = q.validUntil ? new Date(q.validUntil) : undefined;

    return {
      quote: q,
      coverage,
      eligibility,
      validUntil,
      expired: Boolean(validUntil && validUntil.getTime() < Date.now())
    };
  });

  // With no exchange rates in the system, scoring across currencies would
  // silently crown the wrong supplier. Report the responses, rank nothing.
  if (currencies.length > 1) {
    base.mixedCurrency = true;
    base.responses = rows.map((r) => blankResponse(r, lineCount, weights, [
      'Responses are in more than one currency and cannot be compared on price.'
    ]));
    return base;
  }

  const totals = rows.map((r) => r.quote.totalAmount || 0).filter((t) => t > 0);
  const lowestTotal = totals.length ? Math.min(...totals) : undefined;
  const highestTotal = totals.length ? Math.max(...totals) : undefined;

  const periods = rows
    .map((r) => r.quote.deliveryPeriod)
    .filter((d: any): d is number => typeof d === 'number' && d > 0);
  const fastest = periods.length ? Math.min(...periods) : undefined;

  const scored: RankedResponse[] = rows.map((r) => {
    const q = r.quote;
    const total = q.totalAmount || 0;
    const supplierId = idStr(q.supplier);

    // Price: the cheapest scores 1, everything else in proportion. A response
    // with no usable total scores zero here rather than being dropped, so the
    // officer still sees it in the table.
    const priceNorm = lowestTotal && total > 0 ? lowestTotal / total : 0;

    // Delivery: the fastest scores 1. An unstated period is treated as the
    // slowest offered rather than as missing, because an unstated lead time is
    // not a competitive advantage.
    const period = typeof q.deliveryPeriod === 'number' && q.deliveryPeriod > 0
      ? q.deliveryPeriod
      : undefined;
    const deliveryNorm = fastest && period ? fastest / period : period ? 1 : 0;

    const rawPerformance = performance.get(supplierId);
    const performanceNorm =
      typeof rawPerformance === 'number' ? rawPerformance / 5 : UNRATED_SUPPLIER_PERFORMANCE;

    const completenessNorm = lineCount > 0 ? r.coverage.linesQuoted / lineCount : 0;

    const normalisedBy: Record<RankingCriterionWeight['key'], number> = {
      price: clamp01(priceNorm),
      delivery: clamp01(deliveryNorm),
      performance: clamp01(performanceNorm),
      completeness: clamp01(completenessNorm)
    };

    const scores: RankedCriterionScore[] = weights.map((w) => ({
      key: w.key,
      label: w.label,
      weight: w.weight,
      normalised: Math.round(normalisedBy[w.key] * 1000) / 1000,
      weighted: round1(normalisedBy[w.key] * w.weight),
      assumed: w.key === 'performance' && typeof rawPerformance !== 'number' ? true : undefined
    }));

    const disqualifiers: string[] = [];
    if (!r.coverage.isComplete) {
      disqualifiers.push(
        `Priced ${r.coverage.linesQuoted} of ${lineCount} lines — cannot be awarded as a whole quotation. ` +
          'Use the per-line award matrix to award the lines they did price.'
      );
    }
    if (r.expired) {
      disqualifiers.push(
        `Validity lapsed on ${r.validUntil?.toLocaleDateString()} — ask the supplier to reconfirm before awarding.`
      );
    }
    if (!r.eligibility.eligible) {
      disqualifiers.push(r.eligibility.reason || 'Supplier is not eligible to be awarded.');
    }

    return {
      rank: 0,
      quotationId: idStr(q._id),
      quotationNumber: q.quotationNumber,
      supplierId,
      supplierName: q.supplier?.companyName,
      totalAmount: total,
      currency: q.currency || 'USD',
      deliveryPeriod: q.deliveryPeriod,
      validUntil: r.validUntil,
      score: round1(scores.reduce((sum, s) => sum + s.weighted, 0)),
      scores,
      percentAboveLowest:
        lowestTotal && lowestTotal > 0 && total > 0
          ? round1(((total - lowestTotal) / lowestTotal) * 100)
          : 0,
      isLowest: total > 0 && total === lowestTotal,
      isFastest: Boolean(period && period === fastest),
      linesQuoted: r.coverage.linesQuoted,
      lineCount,
      isComplete: r.coverage.isComplete,
      alternativeLines: r.coverage.alternativeLines,
      recommended: false,
      disqualifiers,
      expired: r.expired,
      notAwardable: !r.eligibility.eligible,
      notAwardableReason: r.eligibility.eligible ? undefined : r.eligibility.reason
    };
  });

  // Highest score first; cheaper breaks a score tie, so the ordering is stable
  // and never arbitrary between two equally-scored responses.
  scored.sort((a, b) => b.score - a.score || a.totalAmount - b.totalAmount);
  scored.forEach((r, i) => {
    r.rank = i + 1;
  });

  const pick = chooseRecommendation(scored, lowestTotal);
  if (pick) {
    pick.response.recommended = true;
    pick.response.recommendationReason = pick.reason;
    base.recommendedQuotationId = pick.response.quotationId;
  }

  base.responses = scored;
  base.lowestTotal = lowestTotal;
  base.spreadPercent =
    lowestTotal && lowestTotal > 0 && highestTotal !== undefined
      ? round1(((highestTotal - lowestTotal) / lowestTotal) * 100)
      : 0;

  return base;
}

/**
 * The recommended response and the sentence shown to the approver.
 *
 * Only responses that could actually be awarded are eligible: a partial quote
 * cannot be awarded whole, and an ineligible supplier cannot be awarded at all.
 * Where the top-scoring response is not the cheapest, the reason names the
 * trade-off outright — the officer has to defend that choice, so they should
 * not have to reconstruct it.
 */
function chooseRecommendation(
  ranked: RankedResponse[],
  lowestTotal?: number
): { response: RankedResponse; reason: string } | null {
  const awardable = ranked.filter((r) => r.disqualifiers.length === 0);
  if (awardable.length === 0) return null;

  const best = awardable[0];
  const cheapest = [...awardable].sort((a, b) => a.totalAmount - b.totalAmount)[0];

  if (best.quotationId === cheapest.quotationId) {
    return {
      response: best,
      reason:
        awardable.length === 1
          ? 'Only fully-priced response from a supplier eligible for award.'
          : `Highest score (${best.score}/100) and the lowest price of ${awardable.length} comparable responses.`
    };
  }

  // Scored top but not cheapest: say what is being paid for, in money and days.
  const premium =
    lowestTotal && lowestTotal > 0
      ? `${best.percentAboveLowest}% (${best.currency} ${round1(best.totalAmount - lowestTotal).toLocaleString()}) above the lowest`
      : 'above the lowest';

  const gains: string[] = [];
  if (
    typeof best.deliveryPeriod === 'number' &&
    typeof cheapest.deliveryPeriod === 'number' &&
    best.deliveryPeriod < cheapest.deliveryPeriod
  ) {
    gains.push(`${cheapest.deliveryPeriod - best.deliveryPeriod} days faster`);
  }
  const bestPerf = best.scores.find((s) => s.key === 'performance');
  const cheapPerf = cheapest.scores.find((s) => s.key === 'performance');
  if (bestPerf && cheapPerf && bestPerf.normalised > cheapPerf.normalised && !bestPerf.assumed) {
    gains.push(`a stronger evaluation record (${round1(bestPerf.normalised * 5)}/5)`);
  }

  const within = lowestTotal && lowestTotal > 0
    && (best.totalAmount - lowestTotal) / lowestTotal <= RANKING_TIE_BAND;

  return {
    response: best,
    reason:
      `Highest score (${best.score}/100). ${premium}` +
      (within ? ', within the 2% price tie band' : '') +
      (gains.length ? `, but ${gains.join(' and ')}` : '') +
      `. Lowest-priced response was ${cheapest.supplierName || cheapest.quotationNumber}` +
      ` at ${cheapest.currency} ${cheapest.totalAmount.toLocaleString()}.`
  };
}

/** How much of the RFQ a quotation actually priced. */
function lineCoverage(rfq: IRFQ, quote: any): {
  linesQuoted: number;
  isComplete: boolean;
  alternativeLines: number;
} {
  const rfqLines = (rfq.items as any[]) || [];
  const matched = new Set<string>();
  let alternativeLines = 0;

  for (const qi of (quote.items as any[]) || []) {
    // A line priced at zero has not been quoted; it has been skipped.
    if (!(qi.unitPrice > 0)) continue;

    let key = qi.rfqLineId ? idStr(qi.rfqLineId) : '';
    if (!key || !rfqLines.some((rl) => idStr(rl._id) === key)) {
      // Legacy quotes carry no rfqLineId — fall back to a description match.
      const hit = rfqLines.find((rl) => norm(rl.description) === norm(qi.description));
      key = hit ? idStr(hit._id) : '';
    }
    if (!key) continue;

    matched.add(key);
    if (qi.isAlternative) alternativeLines += 1;
  }

  return {
    linesQuoted: matched.size,
    isComplete: rfqLines.length > 0 && matched.size === rfqLines.length,
    alternativeLines
  };
}

/** A response row with no scores, for the mixed-currency case. */
function blankResponse(
  row: any,
  lineCount: number,
  weights: readonly RankingCriterionWeight[],
  disqualifiers: string[]
): RankedResponse {
  const q = row.quote;
  return {
    rank: 0,
    quotationId: idStr(q._id),
    quotationNumber: q.quotationNumber,
    supplierId: idStr(q.supplier),
    supplierName: q.supplier?.companyName,
    totalAmount: q.totalAmount || 0,
    currency: q.currency || 'USD',
    deliveryPeriod: q.deliveryPeriod,
    validUntil: row.validUntil,
    score: 0,
    scores: weights.map((w) => ({
      key: w.key,
      label: w.label,
      weight: w.weight,
      normalised: 0,
      weighted: 0
    })),
    percentAboveLowest: 0,
    isLowest: false,
    isFastest: false,
    linesQuoted: row.coverage.linesQuoted,
    lineCount,
    isComplete: row.coverage.isComplete,
    alternativeLines: row.coverage.alternativeLines,
    recommended: false,
    disqualifiers,
    expired: row.expired,
    notAwardable: !row.eligibility.eligible,
    notAwardableReason: row.eligibility.eligible ? undefined : row.eligibility.reason
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Record the ranking as it stood at a moment, into QuotationEvaluation.
 *
 * The GET endpoint computes live so a ranking never goes stale, but an award
 * has to be defensible against the figures that were actually in front of the
 * officer. This writes that snapshot when the RFQ closes and bids are revealed.
 *
 * Upserted on `rfq` (which is unique on the model), so re-closing or a later
 * re-rank replaces the snapshot rather than failing on the duplicate key.
 *
 * The model stores criterion scores out of 10, so normalised 0-1 figures are
 * scaled on the way in; `weightedScore` stays in points of the 100 total.
 */
export async function snapshotRanking(
  rfq: IRFQ,
  userId: any,
  ranking?: RfqRanking
): Promise<RfqRanking> {
  const result = ranking ?? (await rankRfqResponses(rfq));

  // Nothing worth recording, and QuotationEvaluation requires scores to mean
  // something — an unscorable ranking is not evidence of anything.
  if (result.responses.length === 0 || result.mixedCurrency) return result;

  await QuotationEvaluation.findOneAndUpdate(
    { rfq: rfq._id },
    {
      rfq: rfq._id,
      evaluatedBy: userId,
      evaluationCriteria: result.weights.map((w) => ({
        criterion: w.label,
        weight: w.weight,
        description: w.description
      })),
      quotationScores: result.responses.map((r) => ({
        quotation: r.quotationId,
        supplier: r.supplierId,
        scores: r.scores.map((s) => ({
          criterion: s.label,
          weight: s.weight,
          score: Math.round(s.normalised * 10 * 100) / 100,
          weightedScore: s.weighted,
          comments: s.assumed ? 'No evaluation history — neutral default applied.' : undefined
        })),
        totalScore: r.score,
        rank: r.rank,
        recommendation: r.recommended
          ? r.recommendationReason
          : r.disqualifiers.length
            ? r.disqualifiers.join(' ')
            : undefined
      })),
      recommendedQuotation: result.recommendedQuotationId || undefined,
      justification: result.responses.find((r) => r.recommended)?.recommendationReason,
      status: 'completed',
      isDeleted: false
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return result;
}
