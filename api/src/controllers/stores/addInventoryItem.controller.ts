import type { Request, Response } from 'express';
import { createAuditLog } from '../../middleware/index.js';
import { resolveSiteId } from '../../lib/siteScope.js';
import { processInventoryRow } from '../../services/inventoryImport.service.js';

const addInventoryItem = async (req: Request, res: Response): Promise<any> => {
  try {
    const { itemCode, code, name, description, category, unit, reorderLevel, currentQuantity, quantity, unitPrice } =
      req.body;

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
        unitPrice
      },
      siteId,
      req.user,
      1
    );

    if (result.status === 'failed') {
      return res.status(400).json({ success: false, message: result.message });
    }

    await createAuditLog({
      action: result.status === 'created' ? 'create' : 'update',
      entity: 'Inventory',
      user: req.user,
      description: `${result.status === 'created' ? 'Added' : 'Updated'} inventory item: ${result.name}`,
      req
    });

    res.status(201).json({ success: true, message: `Item ${result.status}`, data: result });
  } catch (error: any) {
    console.error('Add inventory item error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default addInventoryItem;
