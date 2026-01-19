const { PurchaseOrder, Delivery } = require('../../models');

const getPendingDeliveries = async (req, res) => {
  try {
    // Get issued purchase orders that haven't been fully received
    const query = {
      status: { $in: ['issued', 'partially_received'] },
      isDeleted: false
    };

    const purchaseOrders = await PurchaseOrder.find(query)
      .populate('supplier', 'companyName contactEmail')
      .populate('createdBy', 'firstName lastName')
      .select('poNumber items totalAmount status expectedDeliveryDate issuedAt deliveryAddress supplier')
      .sort({ expectedDeliveryDate: 1, issuedAt: 1 })
      .lean();

    // Check which POs have pending deliveries (created but not yet received)
    const poIds = purchaseOrders.map(po => po._id);
    const pendingDeliveries = await Delivery.find({
      purchaseOrder: { $in: poIds },
      status: 'pending',
      isDeleted: false
    })
      .select('purchaseOrder deliveryNoteNumber expectedDeliveryDate')
      .lean();

    const pendingDeliveriesMap = new Map();
    pendingDeliveries.forEach(d => {
      pendingDeliveriesMap.set(d.purchaseOrder.toString(), {
        deliveryNoteNumber: d.deliveryNoteNumber,
        expectedDeliveryDate: d.expectedDeliveryDate
      });
    });

    const poIdsWithPendingDeliveries = new Set(
      pendingDeliveries.map(d => d.purchaseOrder.toString())
    );

    // Filter to only show POs that either:
    // 1. Have a pending delivery (supplier acknowledged)
    // 2. Are issued but no delivery record exists yet
    const pendingPOs = purchaseOrders.map(po => {
      const poObj = { ...po };
      const pendingDelivery = pendingDeliveriesMap.get(po._id.toString());
      if (pendingDelivery) {
        poObj.pendingDelivery = pendingDelivery;
      }
      return poObj;
    }).filter(po => {
      const hasPendingDelivery = poIdsWithPendingDeliveries.has(po._id.toString());
      // Show if it has pending delivery OR if it's issued and no delivery exists
      return hasPendingDelivery || po.status === 'issued';
    });

    res.status(200).json({
      success: true,
      data: pendingPOs
    });
  } catch (error) {
    console.error('Get pending deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getPendingDeliveries;

