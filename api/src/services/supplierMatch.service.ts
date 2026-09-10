import { SupplierProfile } from '../models/index.js';
import { getRelatedCategoryCodes, getCategoryName } from '@fossil/shared';

/**
 * Match active suppliers to a set of requisition/RFQ category codes.
 *
 * Runs server-side and against the whole supplier collection on purpose: the
 * previous client-side matching only saw the first page of suppliers, so anyone
 * past that page was silently never suggested.
 *
 * - `exact`   — registered under one of the requested category codes. Safe to
 *               auto-select for invitation.
 * - `related` — registered under a different code in the same section. Offered
 *               as a suggestion only, since the trade overlap is approximate.
 */

export interface MatchedSupplier {
  supplier: any;
  matchType: 'exact' | 'related';
  /** The supplier's own codes that produced the match. */
  matchedCategories: string[];
  matchedCategoryNames: string[];
  /**
   * True when the supplier has not been activated yet. They may be invited to
   * quote, but cannot be awarded until KYS verification completes — the caller
   * should show this so nobody is surprised at award time.
   */
  notYetActivated: boolean;
}

export interface SupplierMatchResult {
  exact: MatchedSupplier[];
  related: MatchedSupplier[];
  requestedCategories: string[];
  relatedCategories: string[];
}

export async function matchSuppliersByCategories(
  categoryCodes: string[],
  options: { siteId?: any } = {}
): Promise<SupplierMatchResult> {
  const requested = Array.from(new Set(categoryCodes.filter(Boolean)));
  if (requested.length === 0) {
    return { exact: [], related: [], requestedCategories: [], relatedCategories: [] };
  }

  const related = getRelatedCategoryCodes(requested);

  // Pending suppliers are matched as well as active ones: being invited to
  // quote is not the same as being paid. The eligibility gate still refuses
  // them at award and PO until KYS is complete, so widening invitation widens
  // competition without widening who can receive money. Suspended, blacklisted
  // and dormant suppliers stay excluded.
  const query: any = {
    status: { $in: ['active', 'pending'] },
    isDeleted: false,
    categories: { $in: [...requested, ...related] }
  };
  if (options.siteId) query.site = options.siteId;

  const suppliers = await SupplierProfile.find(query)
    .populate('user', 'email firstName lastName phone')
    .select('companyName tradingName categories status user contactEmail kysComplete kysExempt')
    .sort({ companyName: 1 });

  const exactMatches: MatchedSupplier[] = [];
  const relatedMatches: MatchedSupplier[] = [];

  for (const supplier of suppliers) {
    const own: string[] = (supplier as any).categories || [];
    const hitExact = own.filter((c) => requested.includes(c));

    const notYetActivated = (supplier as any).status !== 'active';

    if (hitExact.length > 0) {
      exactMatches.push({
        supplier,
        matchType: 'exact',
        matchedCategories: hitExact,
        matchedCategoryNames: hitExact.map(getCategoryName),
        notYetActivated
      });
      continue;
    }

    const hitRelated = own.filter((c) => related.includes(c));
    if (hitRelated.length > 0) {
      relatedMatches.push({
        supplier,
        matchType: 'related',
        matchedCategories: hitRelated,
        matchedCategoryNames: hitRelated.map(getCategoryName),
        notYetActivated
      });
    }
  }

  // Most category overlap first — the closest fit for the requisition.
  exactMatches.sort((a, b) => b.matchedCategories.length - a.matchedCategories.length);
  relatedMatches.sort((a, b) => b.matchedCategories.length - a.matchedCategories.length);

  return {
    exact: exactMatches,
    related: relatedMatches,
    requestedCategories: requested,
    relatedCategories: related
  };
}
