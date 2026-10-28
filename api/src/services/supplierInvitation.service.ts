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
  /** True when even exact + related cannot reach the competitive minimum. */
  belowMinimum: boolean;
  minimumRequired: number;
  /** Officer-facing explanation of the shape of this proposal. */
  summary: string;
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
  const exact = match.exact.filter(keep);
  const related = match.related.filter(keep);

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
    belowMinimum,
    minimumRequired: minimum,
    summary: buildSummary({
      exactCount: exact.length,
      topUpCount: topUp.length,
      additionalCount: rest.length,
      excludedCount: ineligible.length,
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
