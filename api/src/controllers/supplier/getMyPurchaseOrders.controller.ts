import type { Request, Response } from 'express';

import { PurchaseOrder, SupplierProfile } from '../../models/index.js';

const getMyPurchaseOrders = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const { status, page = 1, limit = 20 } = req.query as Record<string, any>;
    
    const query = { 
      supplier: profile._id,
      isDeleted: false
    };
    
    // Show all POs except draft, pending, or rejected (suppliers should see approved/issued POs)
    // This includes: approved, issued, partially_received, completed
    if (!status) {
      query.status = { $in: ['approved', 'issued', 'partially_received', 'completed'] };
    } else {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    
    // Debug: Log the query to help troubleshoot
    console.log('Supplier PO Query:', JSON.stringify(query, null, 2));
    
    const [orders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('quotation', 'quotationNumber currency')
        .select('poNumber items totalAmount status expectedDeliveryDate issuedAt createdAt paymentTerms deliveryAddress approvalHistory')
        .sort({ createdAt: -1, issuedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PurchaseOrder.countDocuments(query)
    ]);
    
    // Add acknowledgment status to each order
    const ordersWithAcknowledgment = orders.map(order => {
      const orderObj = order.toObject();
      const isAcknowledged = order.approvalHistory?.some(
        h => h.action === 'acknowledged' && h.by.toString() === req.user!._id.toString()
      );
      orderObj.isAcknowledged = isAcknowledged || false;
      return orderObj;
    });
    
    // Debug: Log results
    console.log(`Found ${orders.length} purchase orders for supplier ${profile._id}`);

    res.status(200).json({
      success: true,
      data: ordersWithAcknowledgment,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get my POs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getMyPurchaseOrders;
