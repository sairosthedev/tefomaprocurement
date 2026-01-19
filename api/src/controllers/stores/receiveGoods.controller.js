const { Delivery, PurchaseOrder, Inventory, StoreTransaction, Item } = require('../../models');
const { createAuditLog } = require('../../middleware');

const receiveGoods = async (req, res) => {
  try {
    const { 
      purchaseOrderId, 
      deliveryNoteNumber, 
      deliveryDate, 
      items, 
      notes 
    } = req.body;

    const po = await PurchaseOrder.findById(purchaseOrderId);
    if (!po || po.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (!['issued', 'partially_received'].includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only receive goods for issued purchase orders'
      });
    }

    // Check if all items are fully received
    let allReceived = true;
    items.forEach(item => {
      const poItem = po.items.id(item.poItem);
      if (poItem) {
        const newTotal = (poItem.quantityReceived || 0) + item.quantityReceived;
        if (newTotal < poItem.quantity) {
          allReceived = false;
        }
      }
    });

    // Check if there's a pending delivery for this PO
    let delivery = await Delivery.findOne({
      purchaseOrder: purchaseOrderId,
      status: 'pending',
      isDeleted: false
    });

    if (delivery) {
      // Update existing pending delivery to received
      delivery.deliveryNoteNumber = deliveryNoteNumber;
      delivery.deliveryDate = new Date(deliveryDate);
      delivery.receivedBy = req.user._id;
      delivery.items = items;
      delivery.isPartialDelivery = !allReceived;
      delivery.isFinalDelivery = allReceived;
      delivery.status = 'received';
      delivery.notes = notes;
      await delivery.save();
    } else {
      // Create new delivery/GRV
      delivery = await Delivery.create({
        purchaseOrder: purchaseOrderId,
        supplier: po.supplier,
        deliveryNoteNumber,
        deliveryDate: new Date(deliveryDate),
        receivedBy: req.user._id,
        items,
        isPartialDelivery: !allReceived,
        isFinalDelivery: allReceived,
        status: 'received',
        notes
      });
    }

    // Update PO quantities and create store transactions
    for (const item of items) {
      const poItem = po.items.id(item.poItem);
      if (poItem) {
        poItem.quantityReceived = (poItem.quantityReceived || 0) + item.quantityReceived;
      }

      // TODO: Update inventory and create store transactions
      // This would require linking PO items to inventory items
    }

    po.status = allReceived ? 'completed' : 'partially_received';
    await po.save();

    await createAuditLog({
      action: 'create',
      entity: 'Delivery',
      entityId: delivery._id,
      user: req.user,
      description: `Received goods: ${delivery.grvNumber} for PO ${po.poNumber}`,
      newData: { grvNumber: delivery.grvNumber, itemCount: items.length },
      req
    });

    res.status(201).json({
      success: true,
      data: delivery
    });
  } catch (error) {
    console.error('Receive goods error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = receiveGoods;

