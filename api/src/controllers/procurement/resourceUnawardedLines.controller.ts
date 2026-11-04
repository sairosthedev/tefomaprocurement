import type { Request, Response } from 'express';
import { RFQ } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { buildLineAwards, collectLineBids, lineIdStr } from '../../services/lineAward.service.js';
import { announceOpenRfq, partitionRfqInvitees } from '../../services/rfqPublication.service.js';

/**
 * Create a new RFQ from the lines of this RFQ that were NOT resolved — lines
 * that received no quotes (`unquoted`) or were quoted but never awarded
 * (`unawarded`). Nothing is lost after a split award: the leftover demand rolls
 * into a fresh sourcing round, pre-inviting the same suppliers (editable).
 */
const resourceUnawardedLines = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { submissionDeadline, supplierIds } = req.body;

    const rfq = await RFQ.findById(id);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }

    // Refresh the line map as the matrix's other writes do. Viewing the matrix
    // no longer stores it, so an RFQ with no line acted on yet has none saved.
    rfq.lineAwards = await buildLineAwards(rfq, await collectLineBids(rfq)) as any;

    // Unresolved = not turned into a PO and not currently an awarded line.
    const unresolved = (rfq.lineAwards as any[]).filter(
      (la) => !la.poGenerated && la.status !== 'awarded'
    );

    if (!unresolved.length) {
      return res.status(400).json({ success: false, message: 'No unquoted or unawarded lines to re-source' });
    }

    // Rebuild RFQ items from the unresolved lines (pull full details from the
    // original RFQ item where available).
    const newItems = unresolved.map((la) => {
      const orig = (rfq.items as any[]).find((it) => lineIdStr(it._id) === lineIdStr(la.rfqLineId));
      return {
        description: la.description || orig?.description,
        categoryName: orig?.categoryName,
        specifications: orig?.specifications,
        quantity: la.quantity || orig?.quantity || 1,
        unit: orig?.unit || 'Each'
      };
    });

    // Pre-fill the same invitees unless the officer supplied a different list.
    const invitees =
      Array.isArray(supplierIds) && supplierIds.length
        ? supplierIds
        : (rfq.invitedSuppliers as any[]).map((inv) => inv.supplier);

    // The new RFQ opens immediately, so it is published here: same eligibility
    // re-check as publishRFQ, and refused if nobody could be sent it.
    const partition = await partitionRfqInvitees({
      invitedSuppliers: invitees.map((s: any) => ({ supplier: s }))
    });
    if (partition.eligible.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No invited supplier is currently eligible to receive this RFQ.',
        data: { ineligible: partition.ineligible }
      });
    }

    const deadline = submissionDeadline
      ? new Date(submissionDeadline)
      : new Date(Date.now() + 7 * 86400000);

    // rfqNumber is required and the model's pre-save hook runs after validation,
    // so set it explicitly (mirrors createRFQ).
    const rfqCount = await RFQ.countDocuments();
    const rfqNumber = `RFQ-${new Date().getFullYear()}-${String(rfqCount + 1).padStart(5, '0')}`;

    const newRfq = await RFQ.create({
      rfqNumber,
      title: `${rfq.title} — re-source (unawarded lines)`,
      description: `Re-sourcing unresolved lines from RFQ ${rfq.rfqNumber}`,
      site: rfq.site,
      purchaseRequisition: rfq.purchaseRequisition,
      items: newItems,
      invitedSuppliers: invitees.map((s: any) => ({ supplier: s, invitedAt: new Date(), responded: false })),
      createdBy: req.user!._id,
      submissionDeadline: deadline,
      status: 'open',
      publishedAt: new Date()
    });

    // Mark the leftover lines on the ORIGINAL RFQ as unawarded (so they are not
    // re-sourced twice) and note the follow-up.
    for (const la of unresolved) {
      if (la.status !== 'unquoted') la.status = 'unawarded';
    }
    await rfq.save();

    await announceOpenRfq(newRfq, req.user!._id, partition);

    await createAuditLog({
      action: 'create', entity: 'RFQ', entityId: newRfq._id, user: req.user,
      description: `Re-sourced ${newItems.length} unresolved line(s) from RFQ ${rfq.rfqNumber} into ${newRfq.rfqNumber}`,
      newData: {
        fromRfq: rfq.rfqNumber, lineCount: newItems.length,
        notified: partition.eligible.length, skipped: partition.ineligible.length
      }, req
    });

    res.status(201).json({
      success: true,
      message: `Created RFQ ${newRfq.rfqNumber} with ${newItems.length} unresolved line(s).`,
      data: newRfq,
      ineligible: partition.ineligible
    });
  } catch (error: any) {
    console.error('Re-source unawarded lines error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default resourceUnawardedLines;
