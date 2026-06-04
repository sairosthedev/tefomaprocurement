import type { Request, Response } from 'express';

import { Delivery, PurchaseOrder, PurchaseRequisition, StoreTransaction, Item } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { resolveSiteId, findOrCreateInventory } from '../../lib/siteScope.js';

const acceptDelivery = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body; // status: 'accepted', 'partially_accepted', 'rejected'

    const delivery = await Delivery.findById(id).populate('purchaseOrder');
    if (!delivery || delivery.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    if (!['received', 'inspected'].includes(delivery.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot accept delivery with status: ${delivery.status}. Delivery must be received or inspected first.`
      });
    }

    const validStatuses = ['accepted', 'partially_accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const previousStatus = delivery.status;
    const po = delivery.purchaseOrder;
    if (!po) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order not found for this delivery'
      });
    }

    // Update inventory when accepting (only for accepted/partially_accepted items)
    // This ensures items are put into stock when delivery is accepted
    if (status === 'accepted' || status === 'partially_accepted') {
      const receiveSiteId =
        delivery.receivedAtSite ||
        po.deliverToSite ||
        (await resolveSiteId(req.user));

      const year = new Date().getFullYear();
      let transactionCounter = await StoreTransaction.countDocuments();

      for (const deliveryItem of delivery.items) {
        // Only process items in 'good' condition
        if (deliveryItem.condition !== 'good') continue;

        const poItem = po.items.id(deliveryItem.poItem);
        if (!poItem) continue;

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
            category: 'General',
            unit: unit,
            status: 'active'
          });
        }

        let inventory = await findOrCreateInventory(inventoryItem._id, receiveSiteId);
        if (!delivery.receivedAtSite) {
          delivery.receivedAtSite = receiveSiteId;
        }

        // Calculate quantity to add (only for accepted items)
        const quantityToAdd = status === 'accepted' 
          ? deliveryItem.quantityReceived 
          : deliveryItem.quantityReceived - (deliveryItem.quantityRejected || 0);

        if (quantityToAdd > 0) {
          const previousQty = inventory.quantityOnHand;
          inventory.quantityOnHand += quantityToAdd;
          inventory.lastReceivedDate = new Date();
          
          // Update unit cost if inventory was empty or if this is a better price
          if (previousQty === 0 || !inventory.unitCost) {
            inventory.unitCost = poItem.unitPrice;
          }
          
          inventory.totalValue = inventory.quantityOnHand * (inventory.unitCost || 0);
          await inventory.save();

          // Generate transaction number (increment counter for each transaction)
          transactionCounter++;
          const transactionNumber = `ST-REC-${year}-${String(transactionCounter).padStart(6, '0')}`;

          // Create store transaction
          await StoreTransaction.create({
            transactionNumber,
            type: 'receipt',
            site: receiveSiteId,
            item: inventoryItem._id,
            inventory: inventory._id,
            quantity: quantityToAdd,
            unitCost: poItem.unitPrice,
            totalValue: quantityToAdd * poItem.unitPrice,
            previousQuantity: previousQty,
            newQuantity: inventory.quantityOnHand,
            reference: {
              type: 'delivery',
              document: delivery._id,
              grvNumber: delivery.grvNumber
            },
            performedBy: req.user!._id,
            notes: `Goods received from PO ${po.poNumber} - Delivery ${delivery.grvNumber || delivery._id}`
          });
        }
      }
    }

    // Update delivery status
    delivery.status = status;
    if (notes) delivery.notes = notes;
    await delivery.save();

    // Check if all deliveries for this PO are accepted and update requisition status
    if (status === 'accepted' && po.purchaseRequisition) {
      // Refresh PO to get latest status
      const updatedPO = await PurchaseOrder.findById(po._id);
      
      const allDeliveries = await Delivery.find({
        purchaseOrder: updatedPO._id,
        isDeleted: false
      });

      // Check if all deliveries are accepted (or partially accepted)
      const allAccepted = allDeliveries.length > 0 && allDeliveries.every(d => 
        d.status === 'accepted' || d.status === 'partially_accepted'
      );

      // Check if PO is fully received
      const allItemsReceived = updatedPO.items.every(item => 
        (item.quantityReceived || 0) >= item.quantity
      );

      // Update requisition to completed if all conditions are met
      if (allAccepted && allItemsReceived && updatedPO.status === 'completed') {
        const requisition = await PurchaseRequisition.findById(updatedPO.purchaseRequisition);
        if (requisition && (requisition as any).status === 'ordered') {
          (requisition as any).status = 'completed';
          (requisition as any).statusHistory.push({
            action: 'po_created',
            by: req.user!._id,
            role: req.user!.role,
            comments: `Purchase order ${updatedPO.poNumber} completed - all goods delivered and accepted`
          });
          await requisition.save();

          await createAuditLog({
            action: 'status_change',
            entity: 'PurchaseRequisition',
            entityId: requisition._id,
            user: req.user,
            description: `Requisition ${requisition.requisitionNumber} completed - all goods delivered and accepted`,
            previousData: { status: 'ordered' },
            newData: { status: 'completed' },
            req
          });
        }
      }
    }

    await createAuditLog({
      action: 'status_change',
      entity: 'Delivery',
      entityId: delivery._id,
      user: req.user,
      description: `Delivery ${delivery.grvNumber || delivery._id} status changed from ${previousStatus} to ${status}`,
      previousData: { status: previousStatus },
      newData: { status },
      req
    });

    res.status(200).json({
      success: true,
      message: `Delivery ${status} successfully`,
      data: delivery
    });
  } catch (error: any) {
    console.error('Accept delivery error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default acceptDelivery;
