import { Quotation } from '../models/index.js';
import type { IRFQ, ILineAward } from '../models/RFQ.model.js';
import { MIN_QUOTATIONS_REQUIRED } from '@fossil/shared';

const idStr = (v: any): string => (v?._id ? v._id.toString() : v?.toString?.() ?? '');
const norm = (s: string) => (s || '').toLowerCase().trim();

export interface LineBid {
  quotationId: string;
  quotationNumber?: string;
  supplierId: string;
  supplierName?: string;
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  /** Header terms carried down to the line so bids can be ranked and compared.
   *  Price is only comparable within a single currency — see bidRanking.service. */
  currency: string;
  deliveryPeriod?: number;
  validUntil?: Date;
  isAlternative?: boolean;
}

/**
 * The live (non-superseded) quotations for an RFQ, with each supplier's name.
 *
 * Takes only the RFQ id, so a caller can run it alongside the RFQ read rather
 * than after it. Line photos are left out: a bid needs its prices, not the
 * supplier's images, and those can run to megabytes.
 */
export function findLiveQuotations(rfqId: any) {
  return Quotation.find({
    rfq: rfqId,
    isDeleted: false,
    status: { $in: ['submitted', 'under_review', 'accepted'] }
  })
    .select('-items.attachments')
    .populate('supplier', 'companyName categories');
}

/**
 * Gather, per RFQ line, the bids from all live (non-superseded) quotations.
 * A quote line is matched to an RFQ line by rfqLineId, falling back to a
 * description match for legacy quotes.
 */
export async function collectLineBids(rfq: IRFQ): Promise<Map<string, LineBid[]>> {
  return groupLineBids(rfq, await findLiveQuotations(rfq._id));
}

/** collectLineBids for quotations already loaded by findLiveQuotations. */
export function groupLineBids(rfq: IRFQ, quotes: any[]): Map<string, LineBid[]> {
  const byLine = new Map<string, LineBid[]>();
  for (const line of rfq.items as any[]) {
    byLine.set(idStr(line._id), []);
  }

  for (const q of quotes) {
    for (const qi of (q as any).items as any[]) {
      let lineKey = qi.rfqLineId ? idStr(qi.rfqLineId) : '';
      if (!lineKey || !byLine.has(lineKey)) {
        const match = (rfq.items as any[]).find((rl) => norm(rl.description) === norm(qi.description));
        lineKey = match ? idStr(match._id) : '';
      }
      if (!lineKey || !byLine.has(lineKey)) continue;
      byLine.get(lineKey)!.push({
        quotationId: idStr(q._id),
        quotationNumber: (q as any).quotationNumber,
        supplierId: idStr((q as any).supplier),
        supplierName: (q as any).supplier?.companyName,
        unitPrice: qi.unitPrice,
        totalPrice: qi.totalPrice,
        quantity: qi.quantity,
        currency: (q as any).currency || 'USD',
        deliveryPeriod: (q as any).deliveryPeriod,
        validUntil: (q as any).validUntil,
        isAlternative: Boolean(qi.isAlternative)
      });
    }
  }
  return byLine;
}

/**
 * Initialise the lineAwards array for an RFQ from its items, marking lines with
 * zero bids as 'unquoted'. Preserves any existing award decisions. Pass the
 * bids when the caller has already collected them, to skip a second read.
 */
export async function buildLineAwards(
  rfq: IRFQ,
  collected?: Map<string, LineBid[]>
): Promise<ILineAward[]> {
  const bids = collected ?? (await collectLineBids(rfq));
  const existing = new Map<string, ILineAward>();
  for (const la of rfq.lineAwards || []) existing.set(idStr(la.rfqLineId), la);

  return (rfq.items as any[]).map((line) => {
    const key = idStr(line._id);
    const prior = existing.get(key);
    const hasBids = (bids.get(key)?.length || 0) > 0;
    if (prior && prior.status === 'awarded') return prior;
    return {
      ...(prior || {}),
      rfqLineId: line._id,
      description: line.description,
      quantity: line.quantity,
      status: prior?.status && prior.status !== 'pending'
        ? prior.status
        : hasBids
        ? 'pending'
        : 'unquoted'
    } as ILineAward;
  });
}

/** A line is fully authorized when it has a justified selection and PM authorization, with the
 *  min-3-quotes rule met on that line OR a per-line waiver approved. */
export function lineFullyAuthorized(award: ILineAward, bidCount: number): boolean {
  if (award.status !== 'awarded') return false;
  const waived = Boolean(award.waiver?.waived && award.waiver?.approvedBy);
  const enoughBids = bidCount >= MIN_QUOTATIONS_REQUIRED || waived;
  const hodOk = Boolean(award.hodSelection?.by && award.hodSelection?.justification);
  const pmOk = Boolean(award.pmAuthorization?.by);
  return enoughBids && hodOk && pmOk;
}

export { idStr as lineIdStr };
