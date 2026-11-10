import type { Request, Response } from 'express';
import { validateInventoryLevels } from '@fossil/shared';

import { Inventory } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { canAccessAllSites, userSiteId } from '../../lib/siteScope.js';
import { refuseInvalid } from '../../lib/validation.js';

/**
 * A blank or null value clears the site's own setting, so the catalogue item's
 * level (or the default) applies again. Anything else is a whole number of
 * zero or more, which validateInventoryLevels has already made sure of.
 */
function parseLevel(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return Number(value);
}

/**
 * Set one site's reorder level, reorder quantity and bin location for an item,
 * without touching its quantity. Before this the only way to change a level
 * was to add or import the item again, which also reset what was on hand.
 */
const updateInventoryLevels = async (req: Request, res: Response): Promise<any> => {
  try {
    const inventory = await Inventory.findOne({ _id: req.params.id, isDeleted: false }).populate('item', 'name code');
    if (!inventory) {
      return res.status(404).json({ success: false, message: 'Stock record not found' });
    }
    if (!canAccessAllSites(req.user)) {
      const home = userSiteId(req.user);
      if (home && inventory.site?.toString() !== home) {
        return res.status(403).json({ success: false, message: 'You can only change levels for your home site' });
      }
    }

    if (refuseInvalid(res, validateInventoryLevels(req.body))) return;

    const previous = {
      reorderLevel: inventory.reorderLevel ?? null,
      reorderQuantity: inventory.reorderQuantity ?? null,
      location: inventory.location
    };

    if ('reorderLevel' in req.body) {
      inventory.reorderLevel = parseLevel(req.body.reorderLevel);
    }
    if ('reorderQuantity' in req.body) {
      inventory.reorderQuantity = parseLevel(req.body.reorderQuantity);
    }
    if ('location' in req.body) {
      inventory.location = String(req.body.location || '').trim() || undefined;
    }
    await inventory.save();

    const itemName = (inventory.item as any)?.name || 'item';
    await createAuditLog({
      action: 'update',
      entity: 'Inventory',
      entityId: inventory._id,
      entityLabel: itemName,
      user: req.user,
      description: `Changed stock levels for ${itemName}`,
      previousData: previous,
      newData: {
        reorderLevel: inventory.reorderLevel ?? null,
        reorderQuantity: inventory.reorderQuantity ?? null,
        location: inventory.location
      },
      req
    });

    res.status(200).json({ success: true, message: 'Stock levels saved', data: inventory });
  } catch (error: any) {
    console.error('Update inventory levels error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default updateInventoryLevels;
