import type { Request, Response } from 'express';
import { getCategoryName, isValidCategoryCode } from '@fossil/shared';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

/**
 * Stores sets the category of one IR line during review. Requesters describe
 * what they need; stores knows the catalogue, and the category is what
 * procurement later matches suppliers on.
 */
const setRequisitionLineCategory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const lineIndex = Number(req.body.lineIndex);
    const category = String(req.body.category || '').trim();

    if (!Number.isInteger(lineIndex) || lineIndex < 0) {
      return res.status(400).json({ success: false, message: 'Valid lineIndex is required' });
    }
    if (!isValidCategoryCode(category)) {
      return res.status(400).json({ success: false, message: 'Choose a category from the list' });
    }

    const requisition = await PurchaseRequisition.findOne({ _id: id, isDeleted: false });
    if (!requisition) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }
    if (requisition.status !== 'stores_review') {
      return res.status(400).json({ success: false, message: 'Requisition is not in stores review' });
    }

    const line: any = requisition.items[lineIndex];
    if (!line) {
      return res.status(404).json({ success: false, message: 'Line not found' });
    }

    const previous = line.category;
    if (previous === category) {
      return res.status(200).json({ success: true, data: { lineIndex, category } });
    }
    line.category = category;
    await requisition.save();

    await createAuditLog({
      action: 'update',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      entityLabel: requisition.requisitionNumber,
      user: req.user,
      description: `Categorised "${line.description}" on ${requisition.requisitionNumber} as ${getCategoryName(category)}`,
      previousData: { lineIndex, category: previous },
      newData: { lineIndex, category },
      req
    });

    res.status(200).json({ success: true, data: { lineIndex, category } });
  } catch (error: any) {
    console.error('Set requisition line category error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default setRequisitionLineCategory;
