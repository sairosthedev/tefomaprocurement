const { Delivery, PurchaseOrder, Inventory, StoreTransaction, Item, PurchaseRequisition, User } = require('../../models');
const { createAuditLog } = require('../../middleware');
const { notifyUsersByRole, notifySupplier, notifyUsersByDepartment } = require('../../services/notification.service');
const { resolveSiteId, findOrCreateInventory } = require('../../lib/siteScope');

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

    const receiveSiteId =
      po.deliverToSite ||
      (await resolveSiteId(req.user, req.body.receivedAtSiteId));

    if (delivery) {
      // Update existing pending delivery to received
      delivery.deliveryNoteNumber = deliveryNoteNumber;
      delivery.deliveryDate = new Date(deliveryDate);
      delivery.receivedAtSite = receiveSiteId;
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
        receivedAtSite: receiveSiteId,
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

    // Get initial transaction count to avoid race conditions
    let transactionCounter = await StoreTransaction.countDocuments();
    const year = new Date().getFullYear();

    // Update PO quantities and update inventory
    for (const item of items) {
      const poItem = po.items.id(item.poItem);
      if (!poItem) continue;

      // Update PO item quantity received
      poItem.quantityReceived = (poItem.quantityReceived || 0) + item.quantityReceived;

      // Find or create Item by matching description
      let inventoryItem = await Item.findOne({
        $or: [
          { name: { $regex: new RegExp(poItem.description, 'i') } },
          { description: { $regex: new RegExp(poItem.description, 'i') } }
        ],
        isDeleted: false
      });

      // If item not found, create a new one
      if (!inventoryItem) {
        // Generate item code
        const itemCount = await Item.countDocuments();
        const itemCode = `ITEM-${String(itemCount + 1).padStart(6, '0')}`;
        
        // Normalize unit to lowercase to match enum values
        const normalizedUnit = (poItem.unit || 'each').toLowerCase();
        const validUnits = ['each', 'kg', 'litre', 'meter', 'box', 'pack', 'set', 'roll', 'sheet', 'pair'];
        const unit = validUnits.includes(normalizedUnit) ? normalizedUnit : 'each';
        
        inventoryItem = await Item.create({
          code: itemCode,
          name: poItem.description,
          description: poItem.description,
          category: 'General', // Default category
          unit: unit,
          status: 'active'
        });
      }

      let inventory = await findOrCreateInventory(inventoryItem._id, receiveSiteId);
      if (!inventory.unitCost && poItem.unitPrice) {
        inventory.unitCost = poItem.unitPrice;
      }

      // Update inventory quantities (only for items in good condition)
      const goodQuantity = item.condition === 'good' ? item.quantityReceived : 0;
      if (goodQuantity > 0) {
        const previousQty = inventory.quantityOnHand;
        inventory.quantityOnHand += goodQuantity;
        
        // Update unit cost if this is a new item or if we want to use weighted average
        // For now, we'll use the PO unit price if inventory is empty, otherwise keep existing
        if (inventory.quantityOnHand === goodQuantity) {
          inventory.unitCost = poItem.unitPrice || inventory.unitCost;
        }
        
        inventory.lastReceivedDate = new Date();
        await inventory.save();

        // Generate transaction number (increment counter for each transaction)
        transactionCounter++;
        const transactionNumber = `ST-REC-${year}-${String(transactionCounter).padStart(6, '0')}`;

        // Create store transaction for receipt
        await StoreTransaction.create({
          transactionNumber,
          type: 'receipt',
          site: receiveSiteId,
          item: inventoryItem._id,
          inventory: inventory._id,
          quantity: goodQuantity,
          previousQuantity: previousQty,
          newQuantity: inventory.quantityOnHand,
          unitCost: poItem.unitPrice || 0,
          totalValue: goodQuantity * (poItem.unitPrice || 0),
          reference: {
            type: 'grv',
            document: delivery._id
          },
          performedBy: req.user._id,
          notes: `Received from PO ${po.poNumber} - GRV ${delivery.grvNumber || 'Pending'}`
        });
      }
    }

    po.status = allReceived ? 'completed' : 'partially_received';
    await po.save();

    // Auto-accept delivery when goods are received (can be inspected later if needed)
    if (delivery.status === 'received') {
      delivery.status = 'accepted';
      await delivery.save();
    }

    // Update Purchase Requisition status if PO is completed
    if (allReceived && po.purchaseRequisition) {
      const requisition = await PurchaseRequisition.findById(po.purchaseRequisition);
      if (requisition && requisition.status === 'ordered') {
        requisition.status = 'completed';
        requisition.statusHistory.push({
          action: 'po_created',
          by: req.user._id,
          role: req.user.role,
          comments: `Purchase order ${po.poNumber} completed - all goods received and accepted`
        });
        await requisition.save();

        await createAuditLog({
          action: 'status_change',
          entity: 'PurchaseRequisition',
          entityId: requisition._id,
          user: req.user,
          description: `Requisition ${requisition.requisitionNumber} completed - all goods delivered`,
          previousData: { status: 'ordered' },
          newData: { status: 'completed' },
          req
        });

        // Notify the requester that goods are available
        const { createNotification } = require('../../services/notification.service');
        await createNotification({
          recipient: requisition.requestedBy,
          type: 'goods_received',
          title: 'Goods Received - Ready for Collection',
          message: `All items from Purchase Order ${po.poNumber} have been received. You can now request them from stores.`,
          entity: 'PurchaseRequisition',
          entityId: requisition._id,
          relatedUser: req.user._id,
          metadata: { poNumber: po.poNumber, grvNumber: delivery.grvNumber }
        });
      }

      // Notify supplier that delivery was received
      if (po.supplier) {
        await notifySupplier(po.supplier, {
          type: 'goods_received',
          title: 'Delivery Received',
          message: `Your delivery for Purchase Order ${po.poNumber} has been received and accepted.`,
          entity: 'Delivery',
          entityId: delivery._id,
          relatedUser: req.user._id,
          metadata: { poNumber: po.poNumber, grvNumber: delivery.grvNumber }
        });
      }
    }

    // Notify procurement about goods received
    await notifyUsersByRole('procurement_officer', {
      type: 'goods_received',
      title: 'Goods Received',
      message: `Goods have been received for Purchase Order ${po.poNumber}. GRV: ${delivery.grvNumber || 'Pending'}`,
      entity: 'Delivery',
      entityId: delivery._id,
      relatedUser: req.user._id,
      metadata: { poNumber: po.poNumber, grvNumber: delivery.grvNumber }
    });

    await createAuditLog({
      action: 'create',
      entity: 'Delivery',
      entityId: delivery._id,
      user: req.user,
      description: `Received goods: ${delivery.grvNumber} for PO ${po.poNumber}`,
      newData: { grvNumber: delivery.grvNumber, itemCount: items.length, status: delivery.status },
      req
    });

    res.status(201).json({
      success: true,
      data: delivery,
      message: allReceived ? 'All goods received and requisition marked as completed' : 'Goods received successfully'
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

