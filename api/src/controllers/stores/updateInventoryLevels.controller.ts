import type { Request, Response } from 'express';

import { Inventory } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { canAccessAllSites, userSiteId } from '../../lib/siteScope.js';

/**
 * A blank or null value clears the site's own setting, so the catalogue item's
 * level (or the default) applies again. Anything else must be a whole number
 * of zero or more.
 */
function parseLevel(value: unknown, label: string): { ok: true; value: number | null } | { ok: false; message: string } {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return { ok: false, message: `${label} must be a whole number of 0 or more, or left blank` };
  }
  return { ok: true, value: n };
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

    const previous = {
      reorderLevel: inventory.reorderLevel ?? null,
      reorderQuantity: inventory.reorderQuantity ?? null,
      location: inventory.location
    };

    if ('reorderLevel' in req.body) {
      const parsed = parseLevel(req.body.reorderLevel, 'Reorder level');
      if (!parsed.ok) return res.status(400).json({ success: false, message: parsed.message });
      inventory.reorderLevel = parsed.value;
    }
    if ('reorderQuantity' in req.body) {
      const parsed = parseLevel(req.body.reorderQuantity, 'Reorder quantity');
      if (!parsed.ok) return res.status(400).json({ success: false, message: parsed.message });
      inventory.reorderQuantity = parsed.value;
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
