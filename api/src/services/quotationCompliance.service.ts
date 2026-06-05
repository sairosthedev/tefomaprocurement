import { Quotation } from '../models/index.js';
import type { IRFQ } from '../models/RFQ.model.js';
import { MIN_QUOTATIONS_REQUIRED } from '@fosssil/shared';

export async function countSubmittedQuotations(rfqId: string): Promise<number> {
  return Quotation.countDocuments({
    rfq: rfqId,
    isDeleted: false,
    status: { $in: ['submitted', 'under_review', 'accepted', 'rejected'] }
  });
}

export function hasValidQuotationWaiver(rfq: IRFQ): boolean {
  const w = (rfq as any).quotationWaiver;
  return Boolean(w?.waived && w?.reason && w?.approvedBy);
}

export async function meetsMinimumQuotations(rfqId: string, rfq?: IRFQ): Promise<{
  met: boolean;
  count: number;
  waived: boolean;
}> {
  const count = await countSubmittedQuotations(rfqId);
  const waived = rfq ? hasValidQuotationWaiver(rfq) : false;
  return {
    met: count >= MIN_QUOTATIONS_REQUIRED || waived,
    count,
    waived
  };
}

export function quotationFullyAuthorized(rfq: IRFQ, quotationId: string): boolean {
  const qid = String(quotationId);
  const hodOk =
    rfq.hodSelection?.quotation &&
    String(rfq.hodSelection.quotation) === qid &&
    Boolean(rfq.hodSelection.justification);
  const pmOk =
    rfq.pmAuthorization?.quotation &&
    String(rfq.pmAuthorization.quotation) === qid;
  return Boolean(hodOk && pmOk);
}
