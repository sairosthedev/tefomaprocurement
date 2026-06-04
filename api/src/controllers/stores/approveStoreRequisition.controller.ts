import type { Request, Response } from 'express';

import { StoreRequisition, Inventory } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

const approveStoreRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

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

    // Check inventory availability for each item
    const availabilityCheck = [];
    
    for (const reqItem of requisition.items) {
      const inventory = await Inventory.findOne({ item: reqItem.item._id });
      if (!inventory) {
        return res.status(400).json({
          success: false,
          message: `Inventory not found for item: ${reqItem.item.name || reqItem.item.description}`
        });
      }
      
      if (inventory.quantityAvailable < reqItem.quantityRequested) {
        availabilityCheck.push({
          item: reqItem.item.name || reqItem.item.description,
          requested: reqItem.quantityRequested,
          available: inventory.quantityAvailable
        });
      }
    }

    if (availabilityCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available',
        data: availabilityCheck
      });
    }

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
      title: 'Store Requisition Approved',
      message: `Your store requisition ${requisition.requisitionNumber} has been approved and is ready for issuance.`,
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
