import type { Request, Response } from 'express';
import { RFQ } from '../../models/index.js';
import { QUOTATION_WAIVER_TYPES } from '../../models/RFQ.model.js';
import { createAuditLog } from '../../middleware/index.js';
import { isProcurementHead } from '@fossil/shared';
import {
  buildLineAwards,
  collectLineBids,
  lineFullyAuthorized,
  lineIdStr
} from '../../services/lineAward.service.js';

const isProcOfficer = (user: any) =>
  user?.role === 'procurement_officer' || user?.role === 'admin' || isProcurementHead(user);

/** GET the per-line award matrix: each RFQ line, its bids, and award state. */
export const getLineAwardMatrix = async (req: Request, res: Response): Promise<any> => {
  try {
    const rfq = await RFQ.findById(req.params.id);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }
    // Refresh (non-destructive) so newly-arrived quotes and unquoted lines show.
    rfq.lineAwards = await buildLineAwards(rfq) as any;
    await rfq.save();

    const bids = await collectLineBids(rfq);
    const lines = (rfq.lineAwards as any[]).map((la) => {
      const key = lineIdStr(la.rfqLineId);
      const lineBids = bids.get(key) || [];
      return {
        ...(la.toObject?.() ?? la),
        bids: lineBids,
        bidCount: lineBids.length,
        fullyAuthorized: lineFullyAuthorized(la, lineBids.length)
      };
    });

    res.status(200).json({ success: true, data: { rfqId: rfq._id, splitAward: rfq.splitAward, lines } });
  } catch (error: any) {
    console.error('Get line award matrix error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// Find a line award by rfqLineId (throws-style helper returning [rfq, award]).
async function loadLine(id: string, rfqLineId: string) {
  const rfq = await RFQ.findById(id);
  if (!rfq || rfq.isDeleted) return { rfq: null as any, award: null as any };
  if (!rfq.lineAwards?.length) {
    rfq.lineAwards = await buildLineAwards(rfq) as any;
  }
  const award = (rfq.lineAwards as any[]).find((la) => lineIdStr(la.rfqLineId) === String(rfqLineId));
  return { rfq, award };
}

/** HOD selects the winning supplier/quotation for a single RFQ line. */
export const hodSelectLine = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { rfqLineId, quotationId, supplierId, unitPrice, justification } = req.body;
    if (!rfqLineId || !quotationId || !justification?.trim()) {
      return res.status(400).json({ success: false, message: 'rfqLineId, quotationId and justification are required' });
    }

    const { rfq, award } = await loadLine(id, rfqLineId);
    if (!rfq) return res.status(404).json({ success: false, message: 'RFQ not found' });
    if (!award) return res.status(404).json({ success: false, message: 'RFQ line not found' });

    // Department-head selection is restricted like whole-quote selection; a proc
    // officer/head may also record it (they run the sourcing).
    if (req.user!.role !== 'department_head' && !isProcOfficer(req.user)) {
      return res.status(403).json({ success: false, message: 'Not permitted to select for this line' });
    }

    award.status = 'awarded';
    award.awardedQuotation = quotationId;
    award.awardedSupplier = supplierId;
    award.awardedUnitPrice = unitPrice;
    award.hodSelection = { by: req.user!._id, justification: justification.trim(), at: new Date() };
    rfq.splitAward = true;
    await rfq.save();

    await createAuditLog({
      action: 'approve', entity: 'RFQ', entityId: rfq._id, user: req.user,
      description: `HOD selected supplier for RFQ ${rfq.rfqNumber} line ${rfqLineId}`,
      newData: { rfqLineId, quotationId, unitPrice }, req
    });

    res.status(200).json({ success: true, message: 'Line awarded (HOD selection recorded).', data: award });
  } catch (error: any) {
    console.error('HOD select line error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/** Procurement Manager authorizes a single awarded line. */
export const pmAuthorizeLine = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { rfqLineId } = req.body;
    if (!isProcOfficer(req.user)) {
      return res.status(403).json({ success: false, message: 'Procurement Manager authorization required' });
    }
    const { rfq, award } = await loadLine(id, rfqLineId);
    if (!rfq) return res.status(404).json({ success: false, message: 'RFQ not found' });
    if (!award) return res.status(404).json({ success: false, message: 'RFQ line not found' });
    if (award.status !== 'awarded' || !award.hodSelection?.by) {
      return res.status(400).json({ success: false, message: 'Line must have an HOD selection before authorization' });
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
    if (!isProcOfficer(req.user) && req.user!.role !== 'coo') {
      return res.status(403).json({ success: false, message: 'Waiver approval requires COO or Procurement Manager' });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Waiver reason is required' });
    }
    if (waiverType !== undefined && !QUOTATION_WAIVER_TYPES.includes(waiverType)) {
      return res.status(400).json({ success: false, message: `Invalid waiver type. Allowed: ${QUOTATION_WAIVER_TYPES.join(', ')}` });
    }
    const { rfq, award } = await loadLine(id, rfqLineId);
    if (!rfq) return res.status(404).json({ success: false, message: 'RFQ not found' });
    if (!award) return res.status(404).json({ success: false, message: 'RFQ line not found' });

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
