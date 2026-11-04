import type { Request, Response } from 'express';
import { RFQ } from '../../models/index.js';
import { QUOTATION_WAIVER_TYPES } from '../../models/RFQ.model.js';
import { createAuditLog } from '../../middleware/index.js';
import { isProcurementHead, MIN_QUOTATIONS_REQUIRED } from '@fossil/shared';
import {
  buildLineAwards,
  findLiveQuotations,
  groupLineBids,
  lineFullyAuthorized,
  lineIdStr,
  type LineBid
} from '../../services/lineAward.service.js';
import { getSupplierPerformanceScores, rankLineBids } from '../../services/bidRanking.service.js';
import { canSeeBids } from '../../lib/rfqVisibility.js';
import { checkSupplierIdEligibility } from '../../services/supplierEligibility.service.js';
import { formatRfqDeadline } from '../../services/rfqPublication.service.js';

const isProcOfficer = (user: any) =>
  user?.role === 'procurement_officer' || isProcurementHead(user);

const sealedMessage = (rfq: any) =>
  `Bids are sealed until ${formatRfqDeadline(rfq.submissionDeadline)} or until the RFQ is closed.`;

/** Refusal for a line-award write while bids are sealed, shaped like getQuotationById's. */
function refuseSealed(res: Response, rfq: any) {
  return res.status(403).json({
    success: false,
    sealed: true,
    rfqId: rfq._id,
    rfqNumber: rfq.rfqNumber,
    submissionDeadline: rfq.submissionDeadline,
    message: sealedMessage(rfq)
  });
}

/** GET the per-line award matrix: each RFQ line, its bids, and award state. */
export const getLineAwardMatrix = async (req: Request, res: Response): Promise<any> => {
  try {
    // The quotations need only the RFQ id, so they load alongside the RFQ.
    // Nothing from them is sent until the seal check below has passed.
    const [rfq, quotes] = await Promise.all([
      RFQ.findById(req.params.id),
      findLiveQuotations(req.params.id)
    ]);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }

    // Sealed-bid rule, as on getRfqRanking: the matrix is every bid side by
    // side, so while the RFQ is sealed it carries the lines alone — no prices,
    // suppliers or ranks.
    if (!canSeeBids(req.user, rfq)) {
      return res.status(200).json({
        success: true,
        message: sealedMessage(rfq),
        data: {
          rfqId: rfq._id,
          rfqNumber: rfq.rfqNumber,
          splitAward: rfq.splitAward,
          sealed: true,
          submissionDeadline: rfq.submissionDeadline,
          lines: (rfq.items as any[]).map((line) => ({
            rfqLineId: line._id,
            description: line.description,
            quantity: line.quantity,
            bids: []
          }))
        }
      });
    }

    const bids = groupLineBids(rfq, quotes);

    // Refresh (non-destructive) so newly-arrived quotes and unquoted lines
    // show. In memory only: a GET must not write. Each line-award write runs
    // the same refresh and persists it with its own change.
    rfq.lineAwards = await buildLineAwards(rfq, bids) as any;

    // Supplier evaluation scores break near-ties in the ranking. Fetched once
    // for every bidding supplier rather than per line.
    const supplierIds = Array.from(
      new Set([...bids.values()].flat().map((b) => b.supplierId))
    );
    const performance = await getSupplierPerformanceScores(supplierIds);

    const lines = (rfq.lineAwards as any[]).map((la) => {
      const key = lineIdStr(la.rfqLineId);
      const lineBids = bids.get(key) || [];
      const ranking = rankLineBids(lineBids, performance);
      return {
        ...(la.toObject?.() ?? la),
        // Ranked cheapest-first, with one bid flagged `recommended`. Advisory
        // only — the award still requires a selection and PM authorization.
        bids: ranking.bids,
        bidCount: ranking.bids.length,
        lowestUnitPrice: ranking.lowestUnitPrice,
        spreadPercent: ranking.spreadPercent,
        mixedCurrency: ranking.mixedCurrency,
        currencies: ranking.currencies,
        fullyAuthorized: lineFullyAuthorized(la, lineBids.length)
      };
    });

    res.status(200).json({ success: true, data: { rfqId: rfq._id, splitAward: rfq.splitAward, sealed: false, lines } });
  } catch (error: any) {
    console.error('Get line award matrix error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Load an RFQ for a line-award write: the line map refreshed from the live
 * bids (persisted by the caller's save), the requested line's award, and that
 * line's bids.
 */
async function loadLine(id: string, rfqLineId: string) {
  const [rfq, quotes] = await Promise.all([RFQ.findById(id), findLiveQuotations(id)]);
  if (!rfq || rfq.isDeleted) {
    return { rfq: null as any, award: null as any, lineBids: [] as LineBid[] };
  }
  const bids = groupLineBids(rfq, quotes);
  rfq.lineAwards = await buildLineAwards(rfq, bids) as any;
  const award = (rfq.lineAwards as any[]).find((la) => lineIdStr(la.rfqLineId) === String(rfqLineId));
  return { rfq, award, lineBids: award ? bids.get(lineIdStr(award.rfqLineId)) || [] : [] };
}

/** Procurement selects the winning supplier/quotation for a single RFQ line. */
export const selectLine = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    // Older clients also send supplierId and unitPrice. Both are ignored: they
    // are read from the quotation itself, so the award cannot be priced by hand.
    const { rfqLineId, quotationId, justification } = req.body;
    if (!rfqLineId || !quotationId || !justification?.trim()) {
      return res.status(400).json({ success: false, message: 'rfqLineId, quotationId and justification are required' });
    }

    const { rfq, award, lineBids } = await loadLine(id, rfqLineId);
    if (!rfq) return res.status(404).json({ success: false, message: 'RFQ not found' });
    if (!award) return res.status(404).json({ success: false, message: 'RFQ line not found' });

    if (!isProcOfficer(req.user)) {
      return res.status(403).json({ success: false, message: 'Not permitted to select for this line' });
    }
    // Choosing among bids nobody may yet see would also echo the chosen price back.
    if (!canSeeBids(req.user, rfq)) return refuseSealed(res, rfq);
    // Authorization is for one supplier at one price. Changing the winner
    // afterwards would carry that sign-off over to a choice nobody authorized.
    if (award.pmAuthorization?.by) {
      return res.status(400).json({
        success: false,
        message: 'This line is already authorized; its supplier can no longer be changed'
      });
    }
    if (award.poGenerated) {
      return res.status(400).json({ success: false, message: 'A purchase order already exists for this line' });
    }

    // The bid must come from a live quotation on this RFQ that priced this line.
    const bid = lineBids.find((b) => b.quotationId === String(quotationId));
    if (!bid) {
      return res.status(400).json({
        success: false,
        message: 'That quotation has no live bid on this line'
      });
    }

    const eligibility = await checkSupplierIdEligibility(bid.supplierId, 'award');
    if (!eligibility.eligible) {
      return res.status(400).json({ success: false, message: eligibility.reason });
    }

    award.status = 'awarded';
    award.awardedQuotation = bid.quotationId;
    award.awardedSupplier = bid.supplierId;
    award.awardedUnitPrice = bid.unitPrice;
    award.hodSelection = { by: req.user!._id, justification: justification.trim(), at: new Date() };
    rfq.splitAward = true;
    await rfq.save();

    await createAuditLog({
      action: 'approve', entity: 'RFQ', entityId: rfq._id, user: req.user,
      description: `Procurement selected supplier for RFQ ${rfq.rfqNumber} line ${rfqLineId}`,
      newData: { rfqLineId, quotationId, supplierId: bid.supplierId, unitPrice: bid.unitPrice }, req
    });

    res.status(200).json({ success: true, message: 'Line awarded (selection recorded).', data: award });
  } catch (error: any) {
    console.error('Select line error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/** Procurement Manager authorizes a single awarded line. */
export const pmAuthorizeLine = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { rfqLineId } = req.body;
    // Head of Procurement only: the officer who selected must not also authorize.
    if (!isProcurementHead(req.user)) {
      return res.status(403).json({ success: false, message: 'Only the Head of Procurement can authorize a line' });
    }
    const { rfq, award } = await loadLine(id, rfqLineId);
    if (!rfq) return res.status(404).json({ success: false, message: 'RFQ not found' });
    if (!award) return res.status(404).json({ success: false, message: 'RFQ line not found' });
    if (!canSeeBids(req.user, rfq)) return refuseSealed(res, rfq);
    if (award.status !== 'awarded' || !award.hodSelection?.by) {
      return res.status(400).json({ success: false, message: 'Select a supplier for this line before authorizing it' });
    }
    if (String(award.hodSelection.by) === String(req.user!._id)) {
      return res.status(403).json({
        success: false,
        message: 'You selected this supplier, so someone else must authorize it'
      });
    }

    // Re-check the supplier at sign-off: they may have been suspended or
    // blacklisted since the line was selected.
    const eligibility = await checkSupplierIdEligibility(award.awardedSupplier, 'award');
    if (!eligibility.eligible) {
      return res.status(400).json({ success: false, message: eligibility.reason });
    }

    award.pmAuthorization = { by: req.user!._id, at: new Date() };
    await rfq.save();

    await createAuditLog({
      action: 'approve', entity: 'RFQ', entityId: rfq._id, user: req.user,
      description: `PM authorized RFQ ${rfq.rfqNumber} line ${rfqLineId}`, newData: { rfqLineId }, req
    });

    res.status(200).json({ success: true, message: 'Line authorized by Procurement Manager.', data: award });
  } catch (error: any) {
    console.error('PM authorize line error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/** Approve a per-line waiver (a line with fewer than 3 quotes). */
export const waiveLine = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { rfqLineId, reason, waiverType } = req.body;
    if (!isProcurementHead(req.user) && req.user!.role !== 'coo') {
      return res.status(403).json({ success: false, message: 'Only the COO or the Head of Procurement can approve a waiver' });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Waiver reason is required' });
    }
    if (waiverType !== undefined && !QUOTATION_WAIVER_TYPES.includes(waiverType)) {
      return res.status(400).json({ success: false, message: `Invalid waiver type. Allowed: ${QUOTATION_WAIVER_TYPES.join(', ')}` });
    }
    const { rfq, award, lineBids } = await loadLine(id, rfqLineId);
    if (!rfq) return res.status(404).json({ success: false, message: 'RFQ not found' });
    if (!award) return res.status(404).json({ success: false, message: 'RFQ line not found' });
    // How many quotes a line drew is not known until bidding ends.
    if (!canSeeBids(req.user, rfq)) return refuseSealed(res, rfq);
    if (rfq.status === 'cancelled' || rfq.status === 'awarded') {
      return res.status(400).json({
        success: false,
        message: `This RFQ is ${rfq.status}; its waivers can no longer be changed`
      });
    }
    // A waiver excepts a line from the three-quote rule. A line that met the
    // rule needs none, and one granted anyway would outlive the competition.
    const quoteCount = new Set(lineBids.map((b) => b.quotationId)).size;
    if (quoteCount >= MIN_QUOTATIONS_REQUIRED) {
      return res.status(400).json({
        success: false,
        message: `This line has ${quoteCount} quotations, which meets the minimum of ${MIN_QUOTATIONS_REQUIRED}; no waiver is needed`
      });
    }

    award.waiver = {
      waived: true, reason: reason.trim(), waiverType: waiverType || 'other',
      approvedBy: req.user!._id, approvedAt: new Date()
    };
    await rfq.save();

    await createAuditLog({
      action: 'approve', entity: 'RFQ', entityId: rfq._id, user: req.user,
      description: `Approved per-line waiver for RFQ ${rfq.rfqNumber} line ${rfqLineId}`, newData: { rfqLineId, reason }, req
    });

    res.status(200).json({ success: true, message: 'Line waiver approved.', data: award });
  } catch (error: any) {
    console.error('Waive line error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};
