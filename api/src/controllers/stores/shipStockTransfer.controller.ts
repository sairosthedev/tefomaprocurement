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

    // Every line is checked before any stock moves. Checking as it went, a
    // short second line was refused after the first had already left stock,
    // the transfer was never marked shipped, and shipping again took the first
    // line a second time.
    const shipments: Array<{ row: any; qty: number; inventory: any }> = [];
    const neededByInventory = new Map<string, number>();
    for (const line of linesToShip) {
      const row = (transfer.items as any).id(line.itemId);
      if (!row) continue;

      const qty = line.quantity ?? row.quantityRequested - (row.quantityShipped || 0);
      if (qty <= 0) continue;

      const inventory = await findOrCreateInventory(row.item._id, transfer.fromSite);
      const key = inventory._id.toString();
      neededByInventory.set(key, (neededByInventory.get(key) || 0) + qty);
      shipments.push({ row, qty, inventory });
    }

    const short = new Map<string, string>();
    for (const { row, inventory } of shipments) {
      const key = inventory._id.toString();
      const available = Math.max(0, inventory.quantityOnHand - (inventory.quantityReserved || 0));
      const needed = neededByInventory.get(key)!;
      if (available < needed && !short.has(key)) {
        short.set(key, `${row.item.name || row.item.description || 'item'} (need ${needed}, have ${available})`);
      }
    }
    if (short.size > 0) {
      return res.status(400).json({
        success: false,
        message: `Not enough stock at the sending site for: ${Array.from(short.values()).join(', ')}. Nothing was shipped.`
      });
    }

    for (const { row, qty, inventory } of shipments) {
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
