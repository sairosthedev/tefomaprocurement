import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { issueRequisitionLine } from '../../services/storesRequisitionProcess.service.js';

const issuePurchaseRequisitionLine = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const lineIndex = Number(req.body.lineIndex);
    const { notes, itemId } = req.body;

    if (!Number.isInteger(lineIndex) || lineIndex < 0) {
      return res.status(400).json({ success: false, message: 'Valid lineIndex is required' });
    }

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }

    const result = await issueRequisitionLine(requisition, lineIndex, req.user, notes, itemId);

    await createAuditLog({
      action: 'status_change',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Issued ${result.issueQty} for "${result.lineDescription}" on PR ${requisition.requisitionNumber}`,
      newData: {
        lineIndex,
        issueQty: result.issueQty,
        status: result.requisition.status
      },
      req
    });

    res.status(200).json({
      success: true,
      message: result.allLinesFulfilled
        ? `Issued ${result.issueQty} — requisition fully fulfilled (Issue No. ${result.storesIssueNumber})`
        : `Issued ${result.issueQty} for ${result.lineDescription}`,
      data: result.requisition
    });
  } catch (error: any) {
    console.error('Issue PR line error:', error);
    res.status(400).json({ success: false, message: error.message || 'Could not issue line' });
  }
};

export default issuePurchaseRequisitionLine;
