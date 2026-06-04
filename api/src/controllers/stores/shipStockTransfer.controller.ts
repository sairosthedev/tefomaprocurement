import type { Request, Response } from 'express';

import { StockTransfer, StoreTransaction } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { findOrCreateInventory, userSiteId, canAccessAllSites } from '../../lib/siteScope.js';

const shipStockTransfer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { items } = req.body;
    const transfer = await StockTransfer.findById(req.params.id).populate('items.item');

    if (!transfer || transfer.isDeleted) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    if (!['approved', 'pending'].includes(transfer.status)) {
      return res.status(400).json({
        success: false,
        message: 'Transfer must be pending or approved to ship'
      });
    }

    if (!canAccessAllSites(req.user)) {
      const home = userSiteId(req.user);
      if (home !== transfer.fromSite.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Only the sending site can ship this transfer'
        });
      }
    }

    const year = new Date().getFullYear();
    let txCounter = await StoreTransaction.countDocuments();

    const linesToShip =
      items?.length > 0
        ? items
        : transfer.items.map((row: any) => ({
            itemId: row._id.toString(),
            quantity: row.quantityRequested - (row.quantityShipped || 0)
          }));

    for (const line of linesToShip) {
      const row = (transfer.items as any).id(line.itemId);
      if (!row) continue;

      const qty = line.quantity ?? row.quantityRequested - (row.quantityShipped || 0);
      if (qty <= 0) continue;

      const inventory = await findOrCreateInventory(row.item._id, transfer.fromSite);
      inventory.quantityAvailable =
        inventory.quantityOnHand - (inventory.quantityReserved || 0);

      if (inventory.quantityAvailable < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock at source for ${row.item.name || 'item'}`
        });
      }

      const previousQty = inventory.quantityOnHand;
      inventory.quantityOnHand -= qty;
      inventory.lastIssuedDate = new Date();
      await inventory.save();

      txCounter += 1;
      await StoreTransaction.create({
        transactionNumber: `ST-TRF-${year}-${String(txCounter).padStart(6, '0')}`,
        type: 'transfer',
        site: transfer.fromSite,
        item: row.item._id,
        inventory: inventory._id,
        quantity: -qty,
        previousQuantity: previousQty,
        newQuantity: inventory.quantityOnHand,
        reference: { type: 'stock_transfer', document: transfer._id },
        performedBy: req.user!._id,
        notes: `Shipped transfer ${transfer.transferNumber}`
      });

      row.quantityShipped = (row.quantityShipped || 0) + qty;
    }

    transfer.status = 'in_transit';
    transfer.shippedBy = req.user!._id;
    transfer.shippedAt = new Date();
    await transfer.save();

    await createAuditLog({
      action: 'update',
      entity: 'StockTransfer',
      entityId: transfer._id,
      user: req.user,
      description: `Shipped transfer ${transfer.transferNumber}`,
      req
    });

    res.status(200).json({ success: true, data: transfer });
  } catch (error: any) {
    console.error('Ship stock transfer error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default shipStockTransfer;
