import { PurchaseRequisition } from '../models/index.js';
import { matchSuppliersByCategories, type MatchedSupplier } from './supplierMatch.service.js';
import { partitionEligibleSuppliers } from './supplierEligibility.service.js';
import { MIN_QUOTATIONS_REQUIRED, getCategoryName } from '@fossil/shared';

/**
 * Who to invite to an RFQ, decided from the requisition's categories.
 *
 * supplierMatch.service answers "who trades in this category". This answers the
 * narrower operational question: who should actually receive this RFQ, in what
 * order, and why — so the invitation list arrives pre-filled and every name on
 * it carries a recorded reason.
 *
 * The rule is exact-matches-first, topped up to the competitive minimum:
 *   1. Every supplier registered under a requested category code.
 *   2. If that is fewer than MIN_QUOTATIONS_REQUIRED, add the closest related-
 *      category suppliers until the minimum is reached.
 *
 * The top-up exists because an RFQ that draws fewer than three quotes needs a
 * waiver to proceed, and a waiver should be the consequence of a thin market,
 * not of the system declining to look one category sideways.
 *
 * The proposal is a proposal. The officer may add or remove anyone before
 * sending — they are accountable for who was invited, and they may know things
 * the category tree does not, such as a supplier mid-dispute.
 */

export type InvitationBasis = 'exact_category' | 'related_category_topup';

export interface ProposedInvitation {
  supplier: any;
  supplierId: string;
  basis: InvitationBasis;
  /** The supplier's own category codes that produced the match. */
  matchedCategories: string[];
  matchedCategoryNames: string[];
  /** One line, stored on the RFQ and shown in the audit trail. */
  reason: string;
  /** Invitable now, but not yet awardable — KYS still outstanding. */
  notYetActivated: boolean;
}

export interface InvitationProposal {
  /** Pre-selected for the officer, in invitation order. */
  proposed: ProposedInvitation[];
  /** Matched but NOT pre-selected — related-category suppliers beyond the
   *  top-up, offered so the officer can widen competition deliberately. */
  additional: ProposedInvitation[];
  requestedCategories: string[];
  relatedCategories: string[];
  /** Suppliers excluded by the eligibility gate, with the reason. */
  excluded: { supplierId: any; reason: string }[];
  /**
   * Duplicate supplier records collapsed out of the list, with the record kept.
   *
   * Surfaced rather than hidden: a supplier master holding the same company
   * twice is a data problem worth fixing, and the officer should know the
   * shortlist was shorter than the raw match suggested.
   */
  duplicatesCollapsed: { kept: string; dropped: string; key: string }[];
  /** True when even exact + related cannot reach the competitive minimum. */
  belowMinimum: boolean;
  minimumRequired: number;
  /** Officer-facing explanation of the shape of this proposal. */
  summary: string;
}

/**
 * Collapse multiple records of the same company down to one.
 *
 * Two records of one supplier are not two competitors. Without this, a thin
 * category could reach the minimum of three quotations by inviting the same
 * company twice, which satisfies the rule on paper and defeats the point of it.
 *
 * Keyed on registration number, which is the identity the group reconciles
 * suppliers by across business units; falls back to the normalised company name
 * where a legacy record has no number. The better record wins: active over
 * pending, and KYS-complete over not, so the survivor is the one that can
 * actually be awarded.
 */
export function dedupeByCompany(
  matches: MatchedSupplier[]
): { unique: MatchedSupplier[]; collapsed: { kept: string; dropped: string; key: string }[] } {
  const chosen = new Map<string, MatchedSupplier>();
  const order: string[] = [];
  const collapsed: { kept: string; dropped: string; key: string }[] = [];

  const identity = (s: any): string => {
    const reg = String(s.registrationNumber || '').trim().toUpperCase();
    if (reg) return `reg:${reg}`;
    return `name:${String(s.companyName || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
  };

  // Higher is better: a record that can be awarded beats one that cannot.
  const rank = (s: any): number =>
    (s.status === 'active' ? 2 : 0) + (s.kysComplete || s.kysExempt ? 1 : 0);

  for (const m of matches) {
    const key = identity(m.supplier);
    const held = chosen.get(key);

    if (!held) {
      chosen.set(key, m);
      order.push(key);
      continue;
    }

    // Keep the stronger record, and remember both category matches so the
    // surviving entry still explains every code that pulled it in.
    const incomingWins = rank(m.supplier) > rank(held.supplier);
    const keep = incomingWins ? m : held;
    const drop = incomingWins ? held : m;

    keep.matchedCategories = Array.from(
      new Set([...keep.matchedCategories, ...drop.matchedCategories])
    );
    keep.matchedCategoryNames = Array.from(
      new Set([...keep.matchedCategoryNames, ...drop.matchedCategoryNames])
    );

    chosen.set(key, keep);
    collapsed.push({
      kept: String(keep.supplier.companyName || keep.supplier._id),
      dropped: String(drop.supplier._id),
      key
    });
  }

  return { unique: order.map((k) => chosen.get(k)!), collapsed };
}

/** Category codes carried on a requisition's line items. */
export async function categoriesForRequisition(requisitionId: any): Promise<string[]> {
  const requisition = await PurchaseRequisition.findById(requisitionId).select('items');
  if (!requisition) return [];
  return Array.from(
    new Set(
      ((requisition as any).items || [])
        .map((i: any) => i.category)
        .filter(Boolean)
    )
  ) as string[];
}

/**
 * Build the invitation proposal for a set of category codes.
 *
 * Eligibility is checked at the `invite` stage, which admits `pending`
 * suppliers: asking for a price commits nothing, and narrow sourcing is how you
 * end up with one bid. They are flagged `notYetActivated` so nobody is
 * surprised when the award gate refuses them later.
 */
export async function proposeInvitations(
  categoryCodes: string[],
  options: { siteId?: any; minimum?: number } = {}
): Promise<InvitationProposal> {
  const minimum = options.minimum ?? MIN_QUOTATIONS_REQUIRED;
  const match = await matchSuppliersByCategories(categoryCodes, { siteId: options.siteId });

  const empty: InvitationProposal = {
    proposed: [],
    additional: [],
    requestedCategories: match.requestedCategories,
    relatedCategories: match.relatedCategories,
    excluded: [],
    duplicatesCollapsed: [],
    belowMinimum: true,
    minimumRequired: minimum,
    summary: 'No categories on the requisition lines, so no supplier could be matched.'
  };
  if (match.requestedCategories.length === 0) return empty;

  // One eligibility pass over everything matched, rather than per candidate.
  const all = [...match.exact, ...match.related];
  const { eligible, ineligible } = await partitionEligibleSuppliers(
    all.map((m) => m.supplier._id),
    'invite'
  );
  const eligibleIds = new Set(eligible.map((id: any) => String(id)));

  const keep = (m: MatchedSupplier) => eligibleIds.has(String(m.supplier._id));

  // Dedupe across exact and related together, so a company registered under
  // both a requested code and a related one is counted once, under the exact
  // match that is the better reason to invite them.
  const deduped = dedupeByCompany([...match.exact.filter(keep), ...match.related.filter(keep)]);
  const exact = deduped.unique.filter((m) => m.matchType === 'exact');
  const related = deduped.unique.filter((m) => m.matchType === 'related');

  const proposed: ProposedInvitation[] = exact.map((m) => toProposal(m, 'exact_category'));

  // Top up from related categories only as far as the competitive minimum.
  // Inviting the whole related tree trains suppliers to ignore invitations.
  const shortfall = Math.max(0, minimum - proposed.length);
  const topUp = related.slice(0, shortfall);
  const rest = related.slice(shortfall);

  for (const m of topUp) proposed.push(toProposal(m, 'related_category_topup'));

  const total = proposed.length;
  const belowMinimum = total < minimum;

  return {
    proposed,
    additional: rest.map((m) => toProposal(m, 'related_category_topup')),
    requestedCategories: match.requestedCategories,
    relatedCategories: match.relatedCategories,
    excluded: ineligible,
    duplicatesCollapsed: deduped.collapsed,
    belowMinimum,
    minimumRequired: minimum,
    summary: buildSummary({
      exactCount: exact.length,
      topUpCount: topUp.length,
      additionalCount: rest.length,
      excludedCount: ineligible.length,
      duplicateCount: deduped.collapsed.length,
      total,
      minimum,
      belowMinimum
    })
  };
}

/** The proposal for an RFQ raised against a requisition. */
export async function proposeInvitationsForRequisition(
  requisitionId: any,
  options: { siteId?: any } = {}
): Promise<InvitationProposal> {
  const categories = await categoriesForRequisition(requisitionId);
  return proposeInvitations(categories, options);
}

function toProposal(m: MatchedSupplier, basis: InvitationBasis): ProposedInvitation {
  const names = m.matchedCategoryNames?.length
    ? m.matchedCategoryNames
    : m.matchedCategories.map(getCategoryName);

  return {
    supplier: m.supplier,
    supplierId: String(m.supplier._id),
    basis,
    matchedCategories: m.matchedCategories,
    matchedCategoryNames: names,
    reason:
      basis === 'exact_category'
        ? `Registered under the requested category: ${names.join(', ')}.`
        : `Added to reach the minimum of ${MIN_QUOTATIONS_REQUIRED} quotations; registered under the related category ${names.join(', ')}.`,
    notYetActivated: m.notYetActivated
  };
}

function buildSummary(c: {
  exactCount: number;
  topUpCount: number;
  additionalCount: number;
  excludedCount: number;
  duplicateCount: number;
  total: number;
  minimum: number;
  belowMinimum: boolean;
}): string {
  const parts: string[] = [];

  parts.push(
    c.exactCount === 0
      ? 'No supplier is registered under the requested categories.'
      : `${c.exactCount} supplier${c.exactCount === 1 ? '' : 's'} registered under the requested categories.`
  );

  if (c.topUpCount > 0) {
    parts.push(
      `${c.topUpCount} added from related categories to reach the minimum of ${c.minimum} quotations.`
    );
  }
  if (c.additionalCount > 0) {
    parts.push(`${c.additionalCount} more in related categories available if you want to widen it.`);
  }
  if (c.duplicateCount > 0) {
    parts.push(
      `${c.duplicateCount} duplicate supplier record${c.duplicateCount === 1 ? '' : 's'} collapsed — ` +
        'the same company twice is not two quotations.'
    );
  }
  if (c.excludedCount > 0) {
    parts.push(
      `${c.excludedCount} matched supplier${c.excludedCount === 1 ? ' was' : 's were'} excluded as ineligible.`
    );
  }
  if (c.belowMinimum) {
    parts.push(
      `Only ${c.total} can be invited, below the minimum of ${c.minimum} — this RFQ will need an approved quotation waiver to be awarded.`
    );
  }

  return parts.join(' ');
}
