const { StockTransfer, StoreTransaction } = require('../../models');
const { createAuditLog } = require('../../middleware');
const { findOrCreateInventory, userSiteId, canAccessAllSites } = require('../../lib/siteScope');

const receiveStockTransfer = async (req, res) => {
  try {
    const { items } = req.body;
    const transfer = await StockTransfer.findById(req.params.id).populate('items.item');

    if (!transfer || transfer.isDeleted) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    if (transfer.status !== 'in_transit') {
      return res.status(400).json({
        success: false,
        message: 'Transfer must be in transit to receive'
      });
    }

    if (!canAccessAllSites(req.user)) {
      const home = userSiteId(req.user);
      if (home !== transfer.toSite.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Only the receiving site can confirm receipt'
        });
      }
    }

    const year = new Date().getFullYear();
    let txCounter = await StoreTransaction.countDocuments();

    const linesToReceive =
      items?.length > 0
        ? items
        : transfer.items.map((row) => ({
            itemId: row._id.toString(),
            quantity: (row.quantityShipped || 0) - (row.quantityReceived || 0)
          }));

    for (const line of linesToReceive) {
      const row = transfer.items.id(line.itemId);
      if (!row) continue;

      const qty = line.quantity ?? (row.quantityShipped || 0) - (row.quantityReceived || 0);
      if (qty <= 0) continue;

      const sourceInv = await findOrCreateInventory(row.item._id, transfer.fromSite);
      const destInv = await findOrCreateInventory(row.item._id, transfer.toSite);

      const previousQty = destInv.quantityOnHand;
      destInv.quantityOnHand += qty;
      if (!destInv.unitCost && sourceInv.unitCost) {
        destInv.unitCost = sourceInv.unitCost;
      }
      destInv.lastReceivedDate = new Date();
      await destInv.save();

      txCounter += 1;
      await StoreTransaction.create({
        transactionNumber: `ST-TRF-${year}-${String(txCounter).padStart(6, '0')}`,
        type: 'transfer',
        site: transfer.toSite,
        item: row.item._id,
        inventory: destInv._id,
        quantity: qty,
        previousQuantity: previousQty,
        newQuantity: destInv.quantityOnHand,
        unitCost: sourceInv.unitCost,
        totalValue: qty * (sourceInv.unitCost || 0),
        reference: { type: 'stock_transfer', document: transfer._id },
        performedBy: req.user._id,
        notes: `Received transfer ${transfer.transferNumber}`
      });

      row.quantityReceived = (row.quantityReceived || 0) + qty;
    }

    const allReceived = transfer.items.every(
      (row) => row.quantityReceived >= (row.quantityShipped || row.quantityRequested)
    );

    transfer.status = allReceived ? 'received' : 'partially_received';
    transfer.receivedBy = req.user._id;
    transfer.receivedAt = new Date();
    await transfer.save();

    await createAuditLog({
      action: 'update',
      entity: 'StockTransfer',
      entityId: transfer._id,
      user: req.user,
      description: `Received transfer ${transfer.transferNumber}`,
      req
    });

    res.status(200).json({ success: true, data: transfer });
  } catch (error) {
    console.error('Receive stock transfer error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = receiveStockTransfer;
