import type { Request, Response } from 'express';
import { validateRequisitionStoresNotes } from '@fossil/shared';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { resolveSiteId } from '../../lib/siteScope.js';
import { refuseInvalid } from '../../lib/validation.js';
import {
  linesShortOfStock,
  missingCategoryMessage,
  processRequisitionAgainstStock,
  uncategorisedLines
} from '../../services/storesRequisitionProcess.service.js';

const autoProcessRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    if (refuseInvalid(res, validateRequisitionStoresNotes(req.body || {}))) return;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }

    if (requisition.status !== 'stores_review') {
      return res.status(400).json({ success: false, message: 'Requisition is not in stores review' });
    }

    // Checked before any stock moves, so a refusal leaves nothing half done.
    const siteId = requisition.site || (await resolveSiteId(req.user));
    const shortLines = await linesShortOfStock(requisition, siteId);
    const missingCategory = missingCategoryMessage(shortLines);
    if (missingCategory) {
      // Name the lines too, so a screen can mark each one.
      const errors: Record<string, string> = {};
      for (const line of uncategorisedLines(shortLines)) {
        errors[`items.${requisition.items.indexOf(line)}.category`] = 'Choose a category';
      }
      return res.status(400).json({ success: false, message: missingCategory, errors });
    }

    const { requisition: updated, summary, message } = await processRequisitionAgainstStock(
      requisition,
      req.user,
      notes || 'Auto-processed against stock'
    );

    await createAuditLog({
      action: 'status_change',
      entity: 'PurchaseRequisition',
      entityId: updated._id,
      user: req.user,
      description: `Auto-processed PR ${updated.requisitionNumber} against stock`,
      newData: { status: updated.status, ...summary },
      req
    });

    res.status(200).json({
      success: true,
      message,
      data: updated,
      summary
    });
  } catch (error: any) {
    console.error('Auto-process requisition error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default autoProcessRequisition;
