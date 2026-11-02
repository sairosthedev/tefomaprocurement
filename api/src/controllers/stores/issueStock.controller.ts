import type { Request, Response } from 'express';

import { StoreRequisition, StoreTransaction } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';
import { findOrCreateInventory, userSiteId, canAccessAllSites } from '../../lib/siteScope.js';

const issueStock = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params; // Store requisition ID
    const { items, collectedBy } = req.body;

    // Who physically carried the goods away. Optional so existing callers that
    // post an empty body keep working, but recorded whenever supplied — stock
    // leaving the store is a custody hand-over and Rev 9 clause 6.4.4 treats an
    // unauthorised collection as a prohibited practice, which can only be
    // evidenced if the collection is recorded at all.
    const collectedByRecord = collectedBy?.name
      ? {
          name: String(collectedBy.name).trim(),
          idNumber: collectedBy.idNumber ? String(collectedBy.idNumber).trim() : undefined,
          department: collectedBy.department ? String(collectedBy.department).trim() : undefined,
          contactNumber: collectedBy.contactNumber ? String(collectedBy.contactNumber).trim() : undefined,
          signedAt: new Date()
        }
      : undefined;

    const requisition = await StoreRequisition.findById(id).populate('items.item');
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Store requisition not found'
      });
    }

    if (!['approved', 'partially_issued'].includes(requisition.status)) {
      return res.status(400).json({
        success: false,
        message: 'Requisition must be approved before issuing'
      });
    }

    if (!canAccessAllSites(req.user)) {
      const home = userSiteId(req.user);
      if (home && requisition.site?.toString() !== home) {
        return res.status(403).json({
          success: false,
          message: 'You can only issue stock for your home site'
        });
      }
    }

    // If items are not provided, issue all items from the requisition
    let itemsToIssue = [];
    if (items && Array.isArray(items) && items.length > 0) {
      // Use provided items
      itemsToIssue = items;
    } else {
      // Issue all pending items from the requisition
      requisition.items.forEach((reqItem) => {
        const pendingQty = reqItem.quantityRequested - (reqItem.quantityIssued || 0);
        if (pendingQty > 0) {
          itemsToIssue.push({
            itemId: (reqItem as any)._id.toString(),
            quantity: pendingQty
          });
        }
      });
    }

    if (itemsToIssue.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items to issue'
      });
    }

    // Get transaction counter for the year
    const year = new Date().getFullYear();
    const lastTransaction = await StoreTransaction.findOne({
      transactionNumber: { $regex: `^ST-ISS-${year}-` }
    }).sort({ createdAt: -1 });

    let transactionCounter = 0;
    if (lastTransaction && lastTransaction.transactionNumber) {
      const match = lastTransaction.transactionNumber.match(/ST-ISS-\d+-(.+)/);
      if (match) {
        transactionCounter = parseInt(match[1], 10) || 0;
      }
    }

    // Process each item
    for (const issueItem of itemsToIssue) {
      const reqItem = (requisition.items as any).id(issueItem.itemId);
      if (!reqItem) {
        continue;
      }

      // Check if item is populated
      if (!reqItem.item) {
        await reqItem.populate('item');
      }

      const inventory = await findOrCreateInventory(reqItem.item._id, requisition.site);

      // Calculate quantity to issue
      const quantityToIssue = issueItem.quantity || (reqItem.quantityRequested - (reqItem.quantityIssued || 0));
      
      if (quantityToIssue <= 0) {
        continue; // Skip if nothing to issue
      }

      // Recalculate quantityAvailable
      inventory.quantityAvailable = inventory.quantityOnHand - inventory.quantityReserved;

      if (inventory.quantityAvailable < quantityToIssue) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for item: ${reqItem.item.name || reqItem.item.description || 'Unknown'}. Available: ${inventory.quantityAvailable}, Requested: ${quantityToIssue}`
        });
      }

      // Update inventory
      const previousQty = inventory.quantityOnHand;
      inventory.quantityOnHand -= quantityToIssue;
      inventory.lastIssuedDate = new Date();
      await inventory.save();

      // Generate transaction number (increment counter for each transaction)
      transactionCounter++;
      const transactionNumber = `ST-ISS-${year}-${String(transactionCounter).padStart(6, '0')}`;

      // Create store transaction
      await StoreTransaction.create({
        transactionNumber,
        type: 'issue',
        site: requisition.site,
        item: reqItem.item._id,
        inventory: inventory._id,
        quantity: -quantityToIssue,
        previousQuantity: previousQty,
        newQuantity: inventory.quantityOnHand,
        reference: {
          type: 'store_requisition',
          document: requisition._id
        },
        department: requisition.department,
        performedBy: req.user!._id,
        notes: `Issued for requisition ${requisition.requisitionNumber}`
      });

      // Update requisition item
      reqItem.quantityIssued = (reqItem.quantityIssued || 0) + quantityToIssue;
    }

    // Check if all items are fully issued
    const allIssued = requisition.items.every(
      item => item.quantityIssued >= item.quantityRequested
    );

    (requisition as any).status = allIssued ? 'issued' : 'partially_issued';
    (requisition as any).issuedBy = req.user!._id;
    (requisition as any).issuedAt = new Date();
    if (collectedByRecord) (requisition as any).collectedBy = collectedByRecord;

    // Assigned once, on the first issue, so a partially-issued requisition keeps
    // one note number across subsequent collections rather than minting a new
    // document each time.
    if (!(requisition as any).issueNoteNumber) {
      const issuedCount = await StoreRequisition.countDocuments({ issueNoteNumber: { $exists: true, $ne: null } });
      (requisition as any).issueNoteNumber =
        `SIN-${new Date().getFullYear()}-${String(issuedCount + 1).padStart(5, '0')}`;
    }

    await requisition.save();

    await createAuditLog({
      action: 'update',
      entity: 'StoreRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Issued stock for requisition: ${requisition.requisitionNumber}`,
      newData: { status: requisition.status },
      req
    });

    // Notify the requester
    await createNotification({
      recipient: requisition.requestedBy,
      type: 'stock_issued',
      title: 'Stock Issued',
      message: `Stock has been issued for your store requisition ${requisition.requisitionNumber}.`,
      entity: 'StoreRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id,
      metadata: { status: requisition.status }
    });

    res.status(200).json({
      success: true,
      message: 'Stock issued successfully',
      data: requisition
    });
  } catch (error: any) {
    console.error('Issue stock error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default issueStock;
