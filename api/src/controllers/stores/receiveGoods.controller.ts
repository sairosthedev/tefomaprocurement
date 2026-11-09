import type { Request, Response } from 'express';

import { Delivery, PurchaseOrder, StoreTransaction, PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole, notifySupplier, notifyUsersByDepartment, createNotification } from '../../services/notification.service.js';
import { resolveSiteId, findOrCreateInventory } from '../../lib/siteScope.js';
import { catalogItemForOrderLine } from '../../services/storesRequisitionProcess.service.js';

/** What stores accepted and rejected on one GRV, told to the supplier. */
function receiptNoticeForSupplier(po: any, delivery: any, allReceived: boolean, receivedBy: unknown) {
  const lines = (delivery.items || []).map((line: any) => {
    const poItem = line.poItem ? (po.items as any).id(line.poItem) : null;
    const received = Number(line.quantityReceived) || 0;
    const rejected = Math.min(received, Number(line.quantityRejected) || 0);
    return {
      description: line.description || poItem?.description || 'Item',
      received,
      accepted: received - rejected,
      rejected,
      reason: line.rejectionReason || (line.condition && line.condition !== 'good' ? line.condition : undefined)
    };
  });
  const rejectedLines = lines.filter((l: any) => l.rejected > 0);
  const grv = delivery.grvNumber ? ` (GRV ${delivery.grvNumber})` : '';

  const accepted = lines
    .filter((l: any) => l.received > 0)
    .map((l: any) => `${l.description}: ${l.accepted} of ${l.received} accepted`)
    .join('; ');
  const rejected = rejectedLines
    .map((l: any) => `${l.description}: ${l.rejected} rejected${l.reason ? ` (${l.reason})` : ''}`)
    .join('; ');
  const deadline = delivery.returnDeadline
    ? ` Please collect rejected or faulty goods by ${new Date(delivery.returnDeadline).toLocaleDateString('en-ZA')}.`
    : '';
  const outstanding = allReceived ? ' The order is now fully received.' : ' The rest of the order is still outstanding.';

  return {
    type: rejectedLines.length > 0 ? 'delivery_rejected' : 'delivery_accepted',
    title: rejectedLines.length > 0 ? 'Delivery received with rejections' : 'Delivery received',
    message:
      `Stores received your delivery for Purchase Order ${po.poNumber}${grv}. ${accepted ? `${accepted}.` : 'Nothing was accepted.'}` +
      (rejected ? ` Rejected — ${rejected}.${deadline}` : deadline) +
      outstanding,
    entity: 'Delivery',
    entityId: delivery._id,
    relatedUser: receivedBy,
    metadata: {
      poNumber: po.poNumber,
      grvNumber: delivery.grvNumber,
      isSupplier: true,
      isPartialDelivery: !allReceived,
      returnDeadline: delivery.returnDeadline,
      lines
    }
  };
}

const receiveGoods = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      purchaseOrderId,
      deliveryNoteNumber,
      deliveryDate,
      items,
      notes,
      deliveredBy,
      inspectedByName,
      inspectedByDepartment,
      witnesses,
      hasHazardousMaterials,
      msdsReference
    } = req.body;

    // Rev 9 clause 6.6.2: quality checks are performed by a department
    // representative, who is usually not a system user — hence a name rather
    // than a User reference. Left undefined when nobody attended, so the GRV
    // prints an empty block to sign by hand instead of asserting an inspection
    // that never took place.
    const inspectorName = inspectedByName ? String(inspectedByName).trim() : undefined;
    const inspectorDepartment = inspectedByDepartment ? String(inspectedByDepartment).trim() : undefined;

    // Person who physically handed over the goods (supplier's driver/rep)
    const deliveredByRecord = deliveredBy?.name
      ? {
          name: String(deliveredBy.name).trim(),
          idNumber: deliveredBy.idNumber ? String(deliveredBy.idNumber).trim() : undefined,
          company: deliveredBy.company ? String(deliveredBy.company).trim() : undefined,
          vehicleRegistration: deliveredBy.vehicleRegistration
            ? String(deliveredBy.vehicleRegistration).trim()
            : undefined,
          contactNumber: deliveredBy.contactNumber ? String(deliveredBy.contactNumber).trim() : undefined,
          signedAt: new Date()
        }
      : undefined;

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

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Record at least one line received' });
    }

    // Each line as counted and judged at the door. Rejected goods stay on the
    // GRV, for the supplier and the record, but are not taken into stock or
    // counted against the order, so they remain owed. A line in damaged or
    // defective condition with no rejected quantity is rejected in full: such
    // lines never went into stock.
    const lines = items.map((line: any) => {
      const quantityReceived = Math.max(0, Number(line.quantityReceived) || 0);
      const condition = ['good', 'damaged', 'defective'].includes(line.condition) ? line.condition : 'good';
      const stated =
        line.quantityRejected === undefined || line.quantityRejected === null || line.quantityRejected === ''
          ? null
          : Math.max(0, Number(line.quantityRejected) || 0);
      const quantityRejected = Math.min(quantityReceived, stated ?? (condition === 'good' ? 0 : quantityReceived));
      return {
        poItem: line.poItem,
        description: line.description,
        quantityOrdered: line.quantityOrdered,
        quantityReceived,
        quantityRejected,
        rejectionReason: line.rejectionReason ? String(line.rejectionReason).trim() : undefined,
        condition,
        notes: line.notes
      };
    });
    const acceptedOf = (line: { quantityReceived: number; quantityRejected: number }) =>
      line.quantityReceived - line.quantityRejected;

    // Rev 9 clauses 6.6.7-6.6.9: the supplier is told why goods were refused.
    const unexplained = lines.find((line: any) => line.quantityRejected > 0 && line.condition === 'good' && !line.rejectionReason);
    if (unexplained) {
      return res.status(400).json({
        success: false,
        message: `Give a reason for rejecting ${unexplained.description || 'this line'}`
      });
    }

    // The order is complete when every line has been accepted in full.
    let allReceived = true;
    lines.forEach((line: any) => {
      const poItem = (po.items as any).id(line.poItem);
      if (poItem) {
        const newTotal = (poItem.quantityReceived || 0) + acceptedOf(line);
        if (newTotal < poItem.quantity) {
          allReceived = false;
        }
      }
    });
    (po.items as any[]).forEach((poItem: any) => {
      const line = lines.find((l: any) => String(l.poItem) === String(poItem._id));
      if (!line && (poItem.quantityReceived || 0) < poItem.quantity) allReceived = false;
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

    // 5-day return deadline (6.6.7–6.6.9): set when anything is rejected.
    const hasFaultyItems = lines.some((line: any) => line.quantityRejected > 0);
    const returnDeadline = hasFaultyItems
      ? new Date(new Date(deliveryDate).getTime() + 5 * 24 * 60 * 60 * 1000)
      : undefined;

    const witnessRecord = witnesses && (witnesses.mt || witnesses.security || witnesses.sheq)
      ? { mt: witnesses.mt?.trim(), security: witnesses.security?.trim(), sheq: witnesses.sheq?.trim() }
      : undefined;

    if (delivery) {
      // Update existing pending delivery to received
      delivery.deliveryNoteNumber = deliveryNoteNumber;
      delivery.deliveryDate = new Date(deliveryDate);
      delivery.receivedAtSite = receiveSiteId;
      delivery.receivedBy = req.user!._id;
      delivery.receivedAt = new Date();
      if (deliveredByRecord) delivery.deliveredBy = deliveredByRecord;
      if (inspectorName) {
        delivery.inspectedByName = inspectorName;
        delivery.inspectedByDepartment = inspectorDepartment;
        delivery.inspectedAt = new Date();
      }
      if (witnessRecord) delivery.witnesses = witnessRecord;
      if (hasHazardousMaterials !== undefined) delivery.hasHazardousMaterials = Boolean(hasHazardousMaterials);
      if (msdsReference) delivery.msdsReference = String(msdsReference).trim();
      if (returnDeadline) delivery.returnDeadline = returnDeadline;
      delivery.items = lines;
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
        receivedBy: req.user!._id,
        receivedAt: new Date(),
        deliveredBy: deliveredByRecord,
        inspectedByName: inspectorName,
        inspectedByDepartment: inspectorDepartment,
        inspectedAt: inspectorName ? new Date() : undefined,
        witnesses: witnessRecord,
        hasHazardousMaterials: Boolean(hasHazardousMaterials),
        msdsReference: msdsReference ? String(msdsReference).trim() : undefined,
        returnDeadline,
        items: lines,
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
    for (const line of lines) {
      const poItem = (po.items as any).id(line.poItem);
      if (!poItem) continue;

      // Only accepted goods count against the order; rejected ones are still owed.
      const goodQuantity = acceptedOf(line);
      poItem.quantityReceived = (poItem.quantityReceived || 0) + goodQuantity;

      if (goodQuantity > 0) {
        const inventoryItem = await catalogItemForOrderLine(poItem);
        const inventory = await findOrCreateInventory(inventoryItem._id, receiveSiteId);
        if (!inventory.unitCost && poItem.unitPrice) {
          inventory.unitCost = poItem.unitPrice;
        }
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
          performedBy: req.user!._id,
          notes: `Received from PO ${po.poNumber} - GRV ${delivery.grvNumber || 'Pending'}`
        });
      }
    }

    po.status = allReceived ? 'completed' : 'partially_received';
    await po.save();

    // The GRV is decided at the door: what was not rejected is accepted.
    const acceptedTotal = lines.reduce((sum: number, line: any) => sum + acceptedOf(line), 0);
    const rejectedTotal = lines.reduce((sum: number, line: any) => sum + line.quantityRejected, 0);
    if (delivery.status === 'received') {
      delivery.status = rejectedTotal === 0 ? 'accepted' : acceptedTotal === 0 ? 'rejected' : 'partially_accepted';
      await delivery.save();
    }

    // Update Purchase Requisition status if PO is completed
    if (allReceived && po.purchaseRequisition) {
      const requisition = await PurchaseRequisition.findById(po.purchaseRequisition);
      if (requisition && (requisition as any).status === 'ordered') {
        (requisition as any).status = 'completed';
        (requisition as any).statusHistory.push({
          action: 'po_created',
          by: req.user!._id,
          role: req.user!.role,
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
        await createNotification({
          recipient: requisition.requestedBy,
          type: 'goods_received',
          title: 'Goods Received - Ready for Collection',
          message: `All items from Purchase Order ${po.poNumber} have been received. You can now request them from stores.`,
          entity: 'PurchaseRequisition',
          entityId: requisition._id,
          relatedUser: req.user!._id,
          metadata: { poNumber: po.poNumber, grvNumber: delivery.grvNumber }
        });
      }
    }

    // The supplier hears about every GRV, not only the one that completes the
    // order: a partial delivery tells them what is still owed, and rejected
    // goods are theirs to collect, by the return deadline where there is one.
    if (po.supplier) {
      await notifySupplier(po.supplier, receiptNoticeForSupplier(po, delivery, allReceived, req.user!._id));
    }

    // Notify procurement about goods received
    await notifyUsersByRole('procurement_officer', {
      type: 'goods_received',
      title: 'Goods Received',
      message: `Goods have been received for Purchase Order ${po.poNumber}. GRV: ${delivery.grvNumber || 'Pending'}`,
      entity: 'Delivery',
      entityId: delivery._id,
      relatedUser: req.user!._id,
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
      message: rejectedTotal > 0
        ? `Goods received. ${rejectedTotal} rejected and still owed by the supplier.`
        : allReceived
        ? 'All goods received and requisition marked as completed'
        : 'Goods received successfully'
    });
  } catch (error: any) {
    console.error('Receive goods error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default receiveGoods;
