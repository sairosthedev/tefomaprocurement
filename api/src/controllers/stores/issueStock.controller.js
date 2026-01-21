const { StoreRequisition, Inventory, StoreTransaction } = require('../../models');
const { createAuditLog } = require('../../middleware');
const { createNotification } = require('../../services/notification.service');

const issueStock = async (req, res) => {
  try {
    const { id } = req.params; // Store requisition ID
    const { items } = req.body;

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
            itemId: reqItem._id.toString(),
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
      const reqItem = requisition.items.id(issueItem.itemId);
      if (!reqItem) {
        continue;
      }

      // Check if item is populated
      if (!reqItem.item) {
        await reqItem.populate('item');
      }

      const inventory = await Inventory.findOne({ item: reqItem.item._id });
      if (!inventory) {
        return res.status(400).json({
          success: false,
          message: `Inventory not found for item: ${reqItem.item.name || reqItem.item.description || 'Unknown'}`
        });
      }

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
        performedBy: req.user._id,
        notes: `Issued for requisition ${requisition.requisitionNumber}`
      });

      // Update requisition item
      reqItem.quantityIssued = (reqItem.quantityIssued || 0) + quantityToIssue;
    }

    // Check if all items are fully issued
    const allIssued = requisition.items.every(
      item => item.quantityIssued >= item.quantityRequested
    );

    requisition.status = allIssued ? 'issued' : 'partially_issued';
    requisition.issuedBy = req.user._id;
    requisition.issuedAt = new Date();
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
      relatedUser: req.user._id,
      metadata: { status: requisition.status }
    });

    res.status(200).json({
      success: true,
      message: 'Stock issued successfully',
      data: requisition
    });
  } catch (error) {
    console.error('Issue stock error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = issueStock;

