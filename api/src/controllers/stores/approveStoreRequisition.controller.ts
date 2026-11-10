import type { Request, Response } from 'express';
import { validateStoreRequisitionApproval } from '@fossil/shared';

import { StoreRequisition, Inventory } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { refuseInvalid } from '../../lib/validation.js';
import { createNotification } from '../../services/notification.service.js';

const approveStoreRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    if (refuseInvalid(res, validateStoreRequisitionApproval(req.body))) return;

    const requisition = await StoreRequisition.findById(id)
      .populate('items.item');
    
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Store requisition not found'
      });
    }

    if (requisition.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Store requisition is already ${requisition.status}`
      });
    }

    // Marking it ready tells the requester to come and collect, so the stock
    // has to be at this store: the one the goods will be handed over from.
    // Ready to collect is a promise, so the stock is reserved for it: another
    // issue cannot take it before the requester arrives. Lines for the same
    // item are added up before checking.
    const availabilityCheck = [];
    const toReserve = new Map<string, { inventory: any; quantity: number; name: string }>();
    for (const reqItem of requisition.items) {
      const inventory = await Inventory.findOne({ item: reqItem.item._id, site: requisition.site, isDeleted: false });
      if (!inventory) {
        return res.status(400).json({
          success: false,
          message: `${reqItem.item.name || reqItem.item.description} is not stocked at this store`
        });
      }
      const key = inventory._id.toString();
      const entry = toReserve.get(key) || { inventory, quantity: 0, name: reqItem.item.name || reqItem.item.description };
      entry.quantity += Math.max(0, reqItem.quantityRequested - (reqItem.quantityIssued || 0));
      toReserve.set(key, entry);
    }
    for (const { inventory, quantity, name } of toReserve.values()) {
      const available = Math.max(0, inventory.quantityOnHand - (inventory.quantityReserved || 0));
      if (available < quantity) {
        availabilityCheck.push({ item: name, requested: quantity, available });
      }
    }

    if (availabilityCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available',
        data: availabilityCheck
      });
    }

    for (const { inventory, quantity } of toReserve.values()) {
      inventory.quantityReserved = (inventory.quantityReserved || 0) + quantity;
      await inventory.save();
    }
    (requisition as any).stockReserved = true;

    // Approve the requisition
    (requisition as any).status = 'approved';
    (requisition as any).approvedBy = req.user!._id;
    (requisition as any).approvedAt = new Date();
    
    if (comments) {
      (requisition as any).notes = (requisition.notes || '') + `\nApproval: ${comments}`;
    }
    
    await requisition.save();

    await createAuditLog({
      action: 'approve',
      entity: 'StoreRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Approved store requisition ${requisition.requisitionNumber}`,
      newData: { status: 'approved' },
      req
    });

    // Notify the requester
    await createNotification({
      recipient: requisition.requestedBy,
      type: 'store_requisition_approved',
      title: 'Ready to collect',
      message: `Your store requisition ${requisition.requisitionNumber} is ready. Come to stores to collect it.`,
      entity: 'StoreRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    const populatedRequisition = await StoreRequisition.findById(requisition._id)
      .populate('requestedBy', 'firstName lastName')
      .populate('department', 'name')
      .populate('items.item', 'code name description unit')
      .populate('approvedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Store requisition approved',
      data: populatedRequisition
    });
  } catch (error: any) {
    console.error('Approve store requisition error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default approveStoreRequisition;
