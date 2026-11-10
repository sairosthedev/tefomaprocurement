import type { Request, Response } from 'express';
import { validateInventoryItem } from '@fossil/shared';
import { createAuditLog } from '../../middleware/index.js';
import { resolveSiteId } from '../../lib/siteScope.js';
import { refuseInvalid } from '../../lib/validation.js';
import { processInventoryRow } from '../../services/inventoryImport.service.js';
import { Inventory } from '../../models/index.js';

const addInventoryItem = async (req: Request, res: Response): Promise<any> => {
  try {
    const { itemCode, code, name, description, category, unit, reorderLevel, currentQuantity, quantity, unitPrice } =
      req.body;

    if (refuseInvalid(res, validateInventoryItem(req.body))) return;

    const siteId = await resolveSiteId(req.user, req.body.siteId);

    const result = await processInventoryRow(
      {
        code: code || itemCode,
        name,
        description,
        category,
        unit,
        reorderLevel,
        quantity: quantity ?? currentQuantity,
        unitPrice,
        transactionNotes: 'Manual add — opening balance'
      },
      siteId,
      req.user,
      1
    );

    if (result.status === 'failed') {
      return res.status(400).json({ success: false, message: result.message });
    }

    const inventory = await Inventory.findOne({
      item: result.itemId,
      site: siteId,
      isDeleted: false
    })
      .populate('item', 'code name description category unit reorderLevel')
      .populate('site', 'code name type');

    await createAuditLog({
      action: result.status === 'created' ? 'create' : 'update',
      entity: 'Inventory',
      user: req.user,
      description: `${result.status === 'created' ? 'Added' : 'Updated'} inventory item: ${result.name}`,
      req
    });

    res.status(201).json({
      success: true,
      message: `Item ${result.status}`,
      data: inventory || result
    });
  } catch (error: any) {
    console.error('Add inventory item error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default addInventoryItem;
