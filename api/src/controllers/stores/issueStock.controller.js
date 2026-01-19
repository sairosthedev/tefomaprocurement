const { StoreRequisition, Inventory, StoreTransaction } = require('../../models');
const { createAuditLog } = require('../../middleware');

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

    // Process each item
    for (const issueItem of items) {
      const reqItem = requisition.items.id(issueItem.itemId);
      if (!reqItem) continue;

      const inventory = await Inventory.findOne({ item: reqItem.item._id });
      if (!inventory) {
        return res.status(400).json({
          success: false,
          message: `Inventory not found for item: ${reqItem.item.name}`
        });
      }

      if (inventory.quantityAvailable < issueItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for item: ${reqItem.item.name}`
        });
      }

      // Update inventory
      const previousQty = inventory.quantityOnHand;
      inventory.quantityOnHand -= issueItem.quantity;
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
        quantity: -issueItem.quantity,
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
      reqItem.quantityIssued = (reqItem.quantityIssued || 0) + issueItem.quantity;
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

