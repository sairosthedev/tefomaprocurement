/**
 * Scoring policy for ranking RFQ responses.
 *
 * Kept in the shared package so the API that computes a ranking and the screen
 * that displays it cannot disagree about what a score means — a ranking whose
 * weights differ between the two is worse than no ranking at all.
 *
 * The ranking is ADVISORY. It produces a recommendation and the reasoning
 * behind it so the person deciding has a benchmark to justify against; the
 * award itself stays a human decision (HOD selection, then PM authorization),
 * which is what the procurement procedure requires.
 */

export interface RankingCriterionWeight {
  key: 'price' | 'delivery' | 'performance' | 'completeness';
  label: string;
  weight: number;
  /** Shown as a tooltip wherever the score breakdown appears. */
  description: string;
}

/**
 * Default criterion weights, summing to 100.
 *
 * Price carries half the score deliberately. The rest exists so that a quote
 * which is marginally cheaper but three weeks slower, from a supplier who has
 * let the business down before, does not win on price alone — not so that a
 * materially cheaper bid can be displaced by a better-liked supplier.
 */
export const DEFAULT_RANKING_WEIGHTS: readonly RankingCriterionWeight[] = Object.freeze([
  {
    key: 'price',
    label: 'Price',
    weight: 50,
    description:
      'Quoted total against the lowest comparable total. The cheapest response scores full marks.'
  },
  {
    key: 'delivery',
    label: 'Delivery',
    weight: 20,
    description:
      'Quoted delivery period against the shortest offered. The fastest response scores full marks.'
  },
  {
    key: 'performance',
    label: 'Past performance',
    weight: 20,
    description:
      'Average of this supplier’s approved evaluation scores. Suppliers with no evaluation history score a neutral default rather than zero.'
  },
  {
    key: 'completeness',
    label: 'Completeness',
    weight: 10,
    description:
      'Proportion of the RFQ lines the supplier actually priced. A partial response cannot be awarded whole.'
  }
]);

/**
 * Score given for past performance when a supplier has never been evaluated.
 *
 * Zero would lock out every new supplier permanently — they cannot earn an
 * evaluation without first winning work. Full marks would rank an unknown
 * above a supplier with a good, real record. This is a deliberate middle, and
 * responses scored this way are flagged so the officer knows the figure is an
 * assumption rather than a measurement.
 */
export const UNRATED_SUPPLIER_PERFORMANCE = 0.6;

/**
 * Responses whose total is within this fraction of the cheapest are treated as
 * a price tie, matching the per-line ranking in bidRanking.service.
 */
export const RANKING_TIE_BAND = 0.02;

/** Maximum achievable ranking score. */
export const RANKING_MAX_SCORE = 100;
