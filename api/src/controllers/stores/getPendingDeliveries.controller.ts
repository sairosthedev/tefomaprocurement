import type { Request, Response } from 'express';

import { PurchaseOrder, Delivery } from '../../models/index.js';

const getPendingDeliveries = async (req: Request, res: Response): Promise<any> => {
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

    // Every order with goods still due, including the balance of one already
    // part-delivered: the supplier's pending delivery is used up by the first
    // GRV, and leaving those orders out left their balance with no way in.
    const pendingPOs = purchaseOrders.map(po => {
      const poObj = { ...po };
      const pendingDelivery = pendingDeliveriesMap.get(po._id.toString());
      if (pendingDelivery) {
        (poObj as any).pendingDelivery = pendingDelivery;
      }
      return poObj;
    });

    res.status(200).json({
      success: true,
      data: pendingPOs
    });
  } catch (error: any) {
    console.error('Get pending deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getPendingDeliveries;
