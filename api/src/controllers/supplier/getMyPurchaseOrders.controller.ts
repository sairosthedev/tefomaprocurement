import type { Request, Response } from 'express';

import { Invoice, PurchaseOrder, SupplierProfile } from '../../models/index.js';

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
    
    const query: any = { 
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
        .select('poNumber items subtotal vatAmount totalAmount currency status expectedDeliveryDate issuedAt createdAt paymentTerms deliveryAddress approvalHistory')
        .sort({ createdAt: -1, issuedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PurchaseOrder.countDocuments(query)
    ]);
    
    // The latest invoice on each order, so the supplier can see whether it has
    // been billed and paid without opening the invoices page.
    const invoices: any[] = await Invoice.find({
      purchaseOrder: { $in: orders.map((o) => o._id) },
      status: { $ne: 'cancelled' }
    })
      .sort({ createdAt: -1 })
      .select('purchaseOrder invoiceNumber status')
      .lean();
    const latestInvoice = new Map<string, any>();
    for (const inv of invoices) {
      const key = String(inv.purchaseOrder);
      if (!latestInvoice.has(key)) latestInvoice.set(key, { invoiceNumber: inv.invoiceNumber, status: inv.status });
    }

    // Add acknowledgment status to each order
    const ordersWithAcknowledgment = orders.map(order => {
      const orderObj: any = order.toObject();
      orderObj.invoice = latestInvoice.get(String(order._id)) || null;
      const isAcknowledged = order.approvalHistory?.some(
        (h: any) => h.action === 'acknowledged' && String(h.by) === String((req.user as any)._id)
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
