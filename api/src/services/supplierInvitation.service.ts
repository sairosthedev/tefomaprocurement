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
  /**
   * Records sharing a company name but holding different registration numbers.
   *
   * Kept in the list, because dropping a possibly-genuine supplier is the worse
   * error, but counted as one competitor and reported so the officer can have
   * the supplier master cleaned up.
   */
  suspectedDuplicates: { companyName: string; registrationNumbers: string[] }[];
  /** True when there are fewer than `minimumRequired` DISTINCT competitors. */
  belowMinimum: boolean;
  minimumRequired: number;
  /** Officer-facing explanation of the shape of this proposal. */
  summary: string;
}

/** Registration number as an identity: the key the group reconciles suppliers
 *  by across business units. */
const regKey = (s: any): string => String(s.registrationNumber || '').trim().toUpperCase();

/** Company name, normalised for comparison. */
const nameKey = (s: any): string =>
  String(s.companyName || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * How many genuinely distinct competitors a set of matches represents.
 *
 * Counts distinct company names, not records. Two records that present the same
 * name to an officer are one competitor for the purposes of the three-quote
 * rule, whatever their registration numbers say — otherwise the minimum can be
 * reached by inviting what reads as the same company twice, which satisfies the
 * rule on paper and defeats the point of it.
 */
export function distinctCompetitors(matches: MatchedSupplier[]): number {
  return new Set(matches.map((m) => nameKey(m.supplier))).size;
}

/**
 * Collapse multiple records of the same company down to one, and flag the ones
 * that only look like duplicates.
 *
 * Two tiers, because the two cases deserve different treatment:
 *
 *   - Same registration number is the same legal entity. One record is kept and
 *     the other dropped.
 *   - Same company name under *different* registration numbers is only a
 *     suspected duplicate. Both are kept, because silently dropping a supplier
 *     that might be a genuine separate entity is a worse error than showing the
 *     officer two rows and letting them decide. They are reported, and
 *     `distinctCompetitors` still counts them as one, so the three-quote
 *     minimum is not satisfied by the ambiguity.
 *
 * Where a record is dropped, the survivor is the one that can actually be
 * awarded — active over pending, KYS-complete over not — rather than whichever
 * happened to be seen first, and it keeps every category code that pulled
 * either record in so its stated reason stays complete.
 */
export function dedupeByCompany(matches: MatchedSupplier[]): {
  unique: MatchedSupplier[];
  collapsed: { kept: string; dropped: string; key: string }[];
  suspectedDuplicates: { companyName: string; registrationNumbers: string[] }[];
} {
  const chosen = new Map<string, MatchedSupplier>();
  const order: string[] = [];
  const collapsed: { kept: string; dropped: string; key: string }[] = [];

  // Higher is better: a record that can be awarded beats one that cannot.
  const rank = (s: any): number =>
    (s.status === 'active' ? 2 : 0) + (s.kysComplete || s.kysExempt ? 1 : 0);

  for (const m of matches) {
    // No registration number falls back to the name, where an identical name is
    // the only identity available and collapsing is the best we can do.
    const reg = regKey(m.supplier);
    const key = reg ? `reg:${reg}` : `name:${nameKey(m.supplier)}`;
    const held = chosen.get(key);

    if (!held) {
      chosen.set(key, m);
      order.push(key);
      continue;
    }

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

  const unique = order.map((k) => chosen.get(k)!);

  // Same name, different registration numbers: kept, but called out.
  const byName = new Map<string, Set<string>>();
  for (const m of unique) {
    const name = nameKey(m.supplier);
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name)!.add(regKey(m.supplier) || '(none)');
  }

  const suspectedDuplicates = [...byName.entries()]
    .filter(([, regs]) => regs.size > 1)
    .map(([name, regs]) => ({
      companyName:
        unique.find((m) => nameKey(m.supplier) === name)?.supplier.companyName || name,
      registrationNumbers: [...regs].sort()
    }));

  return { unique, collapsed, suspectedDuplicates };
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
    suspectedDuplicates: [],
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

  // Top up from related categories until there are enough DISTINCT competitors,
  // counted by company name rather than by record. Two records presenting the
  // same name are one competitor, so a category holding a duplicate still gets
  // topped up to three real suppliers instead of stopping at an apparent three.
  //
  // Only as far as the minimum: inviting the whole related tree trains suppliers
  // to ignore invitations.
  const chosen: MatchedSupplier[] = [...exact];
  const rest: MatchedSupplier[] = [];

  for (const m of related) {
    if (distinctCompetitors(chosen) < minimum) {
      chosen.push(m);
      proposed.push(toProposal(m, 'related_category_topup'));
    } else {
      rest.push(m);
    }
  }

  const competitors = distinctCompetitors(chosen);
  const belowMinimum = competitors < minimum;

  return {
    proposed,
    additional: rest.map((m) => toProposal(m, 'related_category_topup')),
    requestedCategories: match.requestedCategories,
    relatedCategories: match.relatedCategories,
    excluded: ineligible,
    duplicatesCollapsed: deduped.collapsed,
    suspectedDuplicates: deduped.suspectedDuplicates,
    belowMinimum,
    minimumRequired: minimum,
    summary: buildSummary({
      exactCount: exact.length,
      topUpCount: proposed.length - exact.length,
      additionalCount: rest.length,
      excludedCount: ineligible.length,
      duplicateCount: deduped.collapsed.length,
      suspected: deduped.suspectedDuplicates,
      competitors,
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
  suspected: { companyName: string; registrationNumbers: string[] }[];
  competitors: number;
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
        'the same registration number twice is not two quotations.'
    );
  }
  if (c.suspected.length > 0) {
    const names = c.suspected.map((d) => d.companyName).join(', ');
    parts.push(
      `${names} appear${c.suspected.length === 1 ? 's' : ''} more than once under different ` +
        'registration numbers. Both records are listed, but they count as one supplier here — ' +
        'worth cleaning up in the supplier register.'
    );
  }
  if (c.excludedCount > 0) {
    parts.push(
      `${c.excludedCount} matched supplier${c.excludedCount === 1 ? ' was' : 's were'} excluded as ineligible.`
    );
  }
  if (c.belowMinimum) {
    parts.push(
      `Only ${c.competitors} distinct supplier${c.competitors === 1 ? '' : 's'} can be invited, ` +
        `below the minimum of ${c.minimum} — this RFQ will need an approved quotation waiver ` +
        'to be awarded.'
    );
  }

  return parts.join(' ');
}
