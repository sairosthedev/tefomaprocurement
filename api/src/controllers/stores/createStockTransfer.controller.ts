import type { Request, Response } from 'express';
import { validateStockTransfer } from '@fossil/shared';

import { StockTransfer, Site, Inventory } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { resolveSiteId, canAccessAllSites } from '../../lib/siteScope.js';
import { refuseInvalid } from '../../lib/validation.js';

const createStockTransfer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { fromSiteId, toSiteId, items, notes } = req.body;

    // Sites present and different, at least one line, whole quantities above 0.
    if (refuseInvalid(res, validateStockTransfer(req.body))) return;

    const [fromSite, toSite] = await Promise.all([
      Site.findOne({ _id: fromSiteId, isDeleted: false, status: 'active' }),
      Site.findOne({ _id: toSiteId, isDeleted: false, status: 'active' })
    ]);

    if (!fromSite || !toSite) {
      return res.status(404).json({ success: false, message: 'Site not found' });
    }

    if (!canAccessAllSites(req.user)) {
      const userSite = await resolveSiteId(req.user);
      const allowed =
        userSite.toString() === toSiteId.toString() ||
        userSite.toString() === fromSiteId.toString();
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'You can only create transfers involving your home site'
        });
      }
    }

    // No line asks for more than the sending site can spare: what is on hand
    // less what is held for collection, as shipping will count it.
    const itemIds = Array.from(new Set(items.map((row: any) => String(row.itemId ?? row.item))));
    const stock = await Inventory.find({ site: fromSiteId, item: { $in: itemIds }, isDeleted: false })
      .select('item quantityOnHand quantityReserved')
      .lean();
    const available: Record<string, number> = Object.fromEntries(itemIds.map((id) => [id, 0]));
    for (const row of stock as any[]) {
      available[String(row.item)] = Math.max(0, (row.quantityOnHand || 0) - (row.quantityReserved || 0));
    }
    if (refuseInvalid(res, validateStockTransfer(req.body, { available }))) return;

    const transferItems = items.map((row: any) => ({
      item: row.itemId || row.item,
      quantityRequested: parseInt(row.quantity, 10),
      notes: row.notes
    }));

    const transfer = await StockTransfer.create({
      fromSite: fromSiteId,
      toSite: toSiteId,
      items: transferItems,
      initiatedBy: req.user!._id,
      status: 'pending',
      notes
    });

    await createAuditLog({
      action: 'create',
      entity: 'StockTransfer',
      entityId: transfer._id,
      user: req.user,
      description: `Created stock transfer ${transfer.transferNumber}`,
      req
    });

    const populated = await StockTransfer.findById(transfer._id)
      .populate('fromSite', 'code name')
      .populate('toSite', 'code name')
      .populate('items.item', 'code name unit');

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    console.error('Create stock transfer error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Server error' });
  }
};

export default createStockTransfer;
