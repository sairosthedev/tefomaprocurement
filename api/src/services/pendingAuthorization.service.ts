import { RFQ, Quotation, User } from '../models/index.js';

const idStr = (v: any): string => (v?._id ? v._id.toString() : v?.toString?.() ?? '');

const fullName = (u: any): string | null =>
  u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || null : null;

export interface PendingAuthorization {
  rfqId: string;
  rfqNumber: string;
  title: string;
  kind: 'quotation' | 'lines';
  quotationId?: string;
  quotationNumber?: string;
  supplierName?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  justification?: string | null;
  /** Lines awaiting authorization (split awards only). */
  lineCount?: number;
  /** Null when the lines span currencies or a price is missing, since a sum
   *  across currencies would be meaningless. */
  linesTotal?: number | null;
  selectedBy: string | null;
  selectedAt: Date | null;
  /** The requester made the selection, so the API will refuse their
   *  authorization; someone else has to sign it off. */
  selectedByMe: boolean;
}

/**
 * Awards waiting on the Head of Procurement's authorization: a whole-quote
 * selection not yet authorized, or split-award lines selected but not yet
 * authorized and not already turned into a PO. The authorize endpoints apply
 * the same conditions, so anything listed here can be acted on.
 */
export async function listPendingAuthorizations(userId: any): Promise<PendingAuthorization[]> {
  const me = idStr(userId);

  const rfqs: any[] = await RFQ.find({
    isDeleted: false,
    status: { $ne: 'cancelled' },
    $or: [
      { 'hodSelection.quotation': { $ne: null } },
      {
        lineAwards: {
          $elemMatch: { status: 'awarded', 'pmAuthorization.by': null, poGenerated: { $ne: true } }
        }
      }
    ]
  })
    .select('rfqNumber title hodSelection pmAuthorization lineAwards')
    .lean();

  const items: PendingAuthorization[] = [];
  const quotationIds = new Set<string>();
  const userIds = new Set<string>();

  for (const rfq of rfqs) {
    const sel = rfq.hodSelection;
    if (sel?.quotation && idStr(rfq.pmAuthorization?.quotation) !== idStr(sel.quotation)) {
      quotationIds.add(idStr(sel.quotation));
      if (sel.approvedBy) userIds.add(idStr(sel.approvedBy));
    }
    for (const la of rfq.lineAwards || []) {
      if (la.status === 'awarded' && !la.pmAuthorization?.by && !la.poGenerated) {
        if (la.awardedQuotation) quotationIds.add(idStr(la.awardedQuotation));
        if (la.hodSelection?.by) userIds.add(idStr(la.hodSelection.by));
      }
    }
  }

  // One lookup each for quotations and selectors rather than populating per RFQ.
  const [quotations, users] = await Promise.all([
    Quotation.find({ _id: { $in: [...quotationIds] } })
      .select('quotationNumber totalAmount currency supplier')
      .populate('supplier', 'companyName')
      .lean(),
    User.find({ _id: { $in: [...userIds] } }).select('firstName lastName').lean()
  ]);
  const quoteById = new Map(quotations.map((q: any) => [idStr(q._id), q]));
  const nameById = new Map(users.map((u: any) => [idStr(u._id), fullName(u)]));

  for (const rfq of rfqs) {
    const sel = rfq.hodSelection;
    if (sel?.quotation && idStr(rfq.pmAuthorization?.quotation) !== idStr(sel.quotation)) {
      const q: any = quoteById.get(idStr(sel.quotation));
      items.push({
        rfqId: idStr(rfq._id),
        rfqNumber: rfq.rfqNumber,
        title: rfq.title,
        kind: 'quotation',
        quotationId: idStr(sel.quotation),
        quotationNumber: q?.quotationNumber,
        supplierName: q?.supplier?.companyName ?? null,
        totalAmount: q?.totalAmount ?? null,
        currency: q?.currency ?? null,
        justification: sel.justification ?? null,
        selectedBy: nameById.get(idStr(sel.approvedBy)) ?? null,
        selectedAt: sel.approvedAt ?? null,
        selectedByMe: Boolean(me) && idStr(sel.approvedBy) === me
      });
    }

    const awaiting = (rfq.lineAwards || []).filter(
      (la: any) => la.status === 'awarded' && !la.pmAuthorization?.by && !la.poGenerated
    );
    if (awaiting.length) {
      let total: number | null = 0;
      const currencies = new Set<string>();
      for (const la of awaiting) {
        const q: any = quoteById.get(idStr(la.awardedQuotation));
        if (q?.currency) currencies.add(q.currency);
        if (typeof la.awardedUnitPrice !== 'number' || typeof la.quantity !== 'number') total = null;
        else if (total !== null) total += la.awardedUnitPrice * la.quantity;
      }
      if (currencies.size > 1) total = null;

      // Lines may be selected at different times; the latest selection is the
      // one that put the RFQ back in the queue.
      const latest = awaiting.reduce((a: any, b: any) =>
        new Date(b.hodSelection?.at || 0) > new Date(a.hodSelection?.at || 0) ? b : a
      );
      items.push({
        rfqId: idStr(rfq._id),
        rfqNumber: rfq.rfqNumber,
        title: rfq.title,
        kind: 'lines',
        lineCount: awaiting.length,
        linesTotal: total,
        currency: currencies.size === 1 ? [...currencies][0] : null,
        justification: awaiting.length === 1 ? awaiting[0].hodSelection?.justification ?? null : null,
        selectedBy: nameById.get(idStr(latest.hodSelection?.by)) ?? null,
        selectedAt: latest.hodSelection?.at ?? null,
        // Only when every waiting line is theirs; any other line they can still authorize.
        selectedByMe: Boolean(me) && awaiting.every((la: any) => idStr(la.hodSelection?.by) === me)
      });
    }
  }

  // Oldest first: the longest-waiting award is the one holding up a PO.
  items.sort((a, b) => new Date(a.selectedAt || 0).getTime() - new Date(b.selectedAt || 0).getTime());
  return items;
}
