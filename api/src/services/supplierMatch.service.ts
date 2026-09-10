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

  const query: any = {
    status: 'active',
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

    if (hitExact.length > 0) {
      exactMatches.push({
        supplier,
        matchType: 'exact',
        matchedCategories: hitExact,
        matchedCategoryNames: hitExact.map(getCategoryName)
      });
      continue;
    }

    const hitRelated = own.filter((c) => related.includes(c));
    if (hitRelated.length > 0) {
      relatedMatches.push({
        supplier,
        matchType: 'related',
        matchedCategories: hitRelated,
        matchedCategoryNames: hitRelated.map(getCategoryName)
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
