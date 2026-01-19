const { PurchaseOrder, SupplierProfile, Delivery } = require('../../models');
const { createAuditLog } = require('../../middleware');

const acknowledgePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await SupplierProfile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const po = await PurchaseOrder.findById(id);
    if (!po || po.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Verify the PO belongs to this supplier
    if (po.supplier.toString() !== profile._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only acknowledge your own purchase orders'
      });
    }

    // Only allow acknowledgment of approved or issued POs
    if (!['approved', 'issued'].includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot acknowledge purchase order with status: ${po.status}. Only approved or issued purchase orders can be acknowledged.`
      });
    }

    // Check if already acknowledged
    const alreadyAcknowledged = po.approvalHistory.some(
      h => h.action === 'acknowledged' && h.by.toString() === req.user._id.toString()
    );

    if (alreadyAcknowledged) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order has already been acknowledged'
      });
    }

    // Add acknowledgment to history
    po.approvalHistory.push({
      action: 'acknowledged',
      by: req.user._id,
      role: 'supplier',
      comments: 'Purchase order acknowledged by supplier'
    });

    // Automatically issue the PO if it's approved (not yet issued)
    if (po.status === 'approved') {
      po.status = 'issued';
      po.issuedAt = new Date();
      po.issuedBy = req.user._id; // Supplier acknowledges, which issues it
      po.approvalHistory.push({
        action: 'issued',
        by: req.user._id,
        role: 'supplier',
        comments: 'Purchase order issued upon supplier acknowledgment'
      });
    }

    await po.save();

    // Create pending delivery record
    // Check if a delivery already exists for this PO
    const existingDelivery = await Delivery.findOne({
      purchaseOrder: po._id,
      isDeleted: false
    });

    if (!existingDelivery) {
      // Create delivery items from PO items
      const deliveryItems = po.items.map(item => ({
        poItem: item._id,
        description: item.description,
        quantityOrdered: item.quantity,
        quantityReceived: 0, // Will be updated when Stores receives goods
        quantityRejected: 0,
        condition: 'good'
      }));

      // Create pending delivery
      const pendingDelivery = await Delivery.create({
        purchaseOrder: po._id,
        supplier: po.supplier,
        deliveryDate: po.expectedDeliveryDate || new Date(),
        expectedDeliveryDate: po.expectedDeliveryDate,
        items: deliveryItems,
        status: 'pending',
        isPartialDelivery: false,
        isFinalDelivery: true,
        notes: 'Delivery pending - awaiting goods from supplier'
      });

      await createAuditLog({
        action: 'create',
        entity: 'Delivery',
        entityId: pendingDelivery._id,
        user: req.user,
        description: `Created pending delivery for PO: ${po.poNumber}`,
        newData: { status: 'pending', poNumber: po.poNumber },
        req
      });
    }

    await createAuditLog({
      action: 'acknowledge',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Supplier acknowledged PO: ${po.poNumber}`,
      newData: { acknowledged: true },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Purchase order acknowledged successfully',
      data: po
    });
  } catch (error) {
    console.error('Acknowledge PO error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = acknowledgePurchaseOrder;

