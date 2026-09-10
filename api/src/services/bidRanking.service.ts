import { SupplierEvaluation } from '../models/index.js';
import type { LineBid } from './lineAward.service.js';

/**
 * Ranking and recommendation for per-line bids.
 *
 * This does NOT award anything. It ranks the bids on a line and marks one as
 * `recommended` so the person deciding has a visible benchmark to justify
 * against — the award itself stays a human decision (HOD selects, PM
 * authorizes), which is what the procurement procedure requires.
 *
 * Price is the primary key. Supplier performance (the average of the approved
 * SupplierEvaluation scores, 1-5) only breaks near-ties, so a materially
 * cheaper bid is never displaced by a better-liked supplier.
 */

/** Bids within this fraction of the cheapest are treated as a price tie. */
const TIE_BAND = 0.02; // 2%

export interface RankedBid extends LineBid {
  rank: number;
  /** How far above the cheapest comparable bid, as a percentage (0 for the cheapest). */
  percentAboveLowest: number;
  isLowest: boolean;
  recommended: boolean;
  /** Average approved evaluation score for this supplier, 1-5, if ever evaluated. */
  performanceScore?: number;
  /** Why this bid was recommended — shown to the approver, and worth auditing. */
  recommendationReason?: string;
  /** Set when the bid could not be price-ranked (see mixedCurrency). */
  notComparable?: boolean;
}

export interface LineRanking {
  bids: RankedBid[];
  /** Cheapest comparable unit price, if any bid was rankable. */
  lowestUnitPrice?: number;
  /** Spread between cheapest and dearest comparable bid, as a percentage. */
  spreadPercent?: number;
  /** True when bids arrived in more than one currency: prices are NOT comparable
   *  and no recommendation is made, because this system holds no exchange rates. */
  mixedCurrency: boolean;
  currencies: string[];
}

/** Latest approved overall score per supplier, keyed by supplier id. */
export async function getSupplierPerformanceScores(
  supplierIds: string[]
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (supplierIds.length === 0) return scores;

  const evaluations = await SupplierEvaluation.find({
    supplier: { $in: supplierIds },
    status: 'approved',
    isDeleted: false
  })
    .select('supplier overallScore createdAt')
    .sort({ createdAt: -1 });

  // Sorted newest-first, so the first score seen per supplier is the current one.
  for (const evaluation of evaluations) {
    const key = String((evaluation as any).supplier);
    if (!scores.has(key) && typeof evaluation.overallScore === 'number' && evaluation.overallScore > 0) {
      scores.set(key, evaluation.overallScore);
    }
  }
  return scores;
}

/**
 * Rank one line's bids cheapest-first and mark a recommendation.
 *
 * Within the tie band the better-performing supplier is recommended; otherwise
 * the cheapest bid is. Alternatives (a supplier offering an equivalent part
 * rather than the exact one) are ranked but never auto-recommended, since
 * whether the substitute is acceptable is an engineering judgement.
 */
export function rankLineBids(
  bids: LineBid[],
  performance: Map<string, number>
): LineRanking {
  const currencies = Array.from(new Set(bids.map((b) => b.currency || 'USD')));
  const mixedCurrency = currencies.length > 1;

  // With no exchange rates in the system, comparing across currencies would
  // silently crown the wrong bid. Rank nothing and say so instead.
  if (mixedCurrency) {
    return {
      bids: bids.map((b) => ({
        ...b,
        rank: 0,
        percentAboveLowest: 0,
        isLowest: false,
        recommended: false,
        notComparable: true,
        performanceScore: performance.get(b.supplierId)
      })),
      mixedCurrency: true,
      currencies
    };
  }

  const sorted = [...bids].sort((a, b) => a.unitPrice - b.unitPrice);
  const lowest = sorted[0]?.unitPrice;
  const highest = sorted[sorted.length - 1]?.unitPrice;

  const ranked: RankedBid[] = sorted.map((bid, index) => ({
    ...bid,
    rank: index + 1,
    percentAboveLowest:
      lowest && lowest > 0 ? Math.round(((bid.unitPrice - lowest) / lowest) * 1000) / 10 : 0,
    isLowest: bid.unitPrice === lowest,
    recommended: false,
    performanceScore: performance.get(bid.supplierId)
  }));

  const pick = chooseRecommended(ranked, lowest);
  if (pick) {
    pick.bid.recommended = true;
    pick.bid.recommendationReason = pick.reason;
  }

  return {
    bids: ranked,
    lowestUnitPrice: lowest,
    spreadPercent:
      lowest && lowest > 0 && highest !== undefined
        ? Math.round(((highest - lowest) / lowest) * 1000) / 10
        : 0,
    mixedCurrency: false,
    currencies
  };
}

/** The recommended bid and the one-line reason shown to the approver. */
function chooseRecommended(
  ranked: RankedBid[],
  lowest?: number
): { bid: RankedBid; reason: string } | null {
  if (!ranked.length || lowest === undefined) return null;

  // An equivalent part is an engineering call, not a price call.
  const exact = ranked.filter((b) => !b.isAlternative);
  if (exact.length === 0) return null;

  const cheapest = exact[0];
  const tied = exact.filter(
    (b) => lowest > 0 && (b.unitPrice - lowest) / lowest <= TIE_BAND
  );

  if (tied.length > 1) {
    const scored = tied.filter((b) => typeof b.performanceScore === 'number');
    if (scored.length > 0) {
      const best = scored.reduce((a, b) =>
        (b.performanceScore || 0) > (a.performanceScore || 0) ? b : a
      );
      if (best !== cheapest && (best.performanceScore || 0) > (cheapest.performanceScore || 0)) {
        return {
          bid: best,
          reason: `Within ${TIE_BAND * 100}% of the lowest price (+${best.percentAboveLowest}%) with a stronger supplier evaluation score (${best.performanceScore}/5).`
        };
      }
    }
  }

  return {
    bid: cheapest,
    reason:
      exact.length === 1
        ? 'Only exact-specification bid received.'
        : `Lowest price of ${exact.length} comparable bids.`
  };
}
