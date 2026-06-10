import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { processRequisitionAgainstStock } from '../../services/storesRequisitionProcess.service.js';

const autoProcessRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }

    if (requisition.status !== 'stores_review') {
      return res.status(400).json({ success: false, message: 'Requisition is not in stores review' });
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
