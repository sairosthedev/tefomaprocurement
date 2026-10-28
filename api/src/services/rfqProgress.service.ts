import { RFQ, Quotation } from '../models/index.js';
import { canSeeBids } from '../lib/rfqVisibility.js';

const idStr = (v: any): string => (v?._id ? v._id.toString() : v?.toString?.() ?? '');

export interface RfqSourcingProgress {
  status: string;
  quotationCount: number;
  /** Bids are still sealed for this viewer; nothing below the count is given. */
  sealed: boolean;
  splitAward: boolean;
  winner: {
    quotationId: string;
    quotationNumber?: string;
    supplierName?: string | null;
    justification?: string | null;
    selectedAt?: Date | null;
  } | null;
  authorized: boolean;
  authorizedAt: Date | null;
  lines: {
    total: number;
    awarded: number;
    authorized: number;
    awaitingAuthorization: number;
    poGenerated: number;
  } | null;
}

/**
 * How far sourcing has got on a requisition's RFQ, for the requisition page.
 *
 * Shown to requesters and department heads as well as procurement, so it
 * carries the outcome (who won, whether it is authorized) and never the
 * competing bids. While bids are sealed it gives the count alone, matching
 * what getRFQById exposes.
 */
export async function getRfqSourcingProgress(rfqId: any, user: any): Promise<RfqSourcingProgress | null> {
  if (!rfqId) return null;
  const rfq: any = await RFQ.findById(idStr(rfqId))
    .select('status submissionDeadline isDeleted splitAward hodSelection pmAuthorization lineAwards')
    .lean();
  if (!rfq || rfq.isDeleted) return null;

  // Same statuses getRFQById counts as bids received.
  const quotationCount = await Quotation.countDocuments({
    rfq: rfq._id,
    status: { $in: ['submitted', 'under_review', 'accepted', 'rejected'] },
    isDeleted: false
  });

  const progress: RfqSourcingProgress = {
    status: rfq.status,
    quotationCount,
    sealed: !canSeeBids(user, rfq),
    splitAward: Boolean(rfq.splitAward),
    winner: null,
    authorized: false,
    authorizedAt: null,
    lines: null
  };
  if (progress.sealed) return progress;

  if (rfq.splitAward && rfq.lineAwards?.length) {
    const awarded = rfq.lineAwards.filter((la: any) => la.status === 'awarded');
    const authorized = awarded.filter((la: any) => la.pmAuthorization?.by);
    progress.lines = {
      total: rfq.lineAwards.length,
      awarded: awarded.length,
      authorized: authorized.length,
      awaitingAuthorization: awarded.length - authorized.length,
      poGenerated: rfq.lineAwards.filter((la: any) => la.poGenerated).length
    };
    progress.authorized = awarded.length > 0 && authorized.length === awarded.length;
    return progress;
  }

  // Under an approved waiver the Head of Procurement may authorize without a
  // prior selection, so the authorized quotation stands in as the winner.
  const winnerId = rfq.hodSelection?.quotation || rfq.pmAuthorization?.quotation;
  if (winnerId) {
    const q: any = await Quotation.findById(winnerId)
      .select('quotationNumber supplier')
      .populate('supplier', 'companyName')
      .lean();
    progress.winner = {
      quotationId: idStr(winnerId),
      quotationNumber: q?.quotationNumber,
      supplierName: q?.supplier?.companyName ?? null,
      justification: rfq.hodSelection?.justification ?? null,
      selectedAt: rfq.hodSelection?.approvedAt ?? null
    };
    progress.authorized =
      Boolean(rfq.pmAuthorization?.quotation) && idStr(rfq.pmAuthorization.quotation) === idStr(winnerId);
    progress.authorizedAt = progress.authorized ? rfq.pmAuthorization?.authorizedAt ?? null : null;
  }

  return progress;
}
