import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

import { Invoice, PurchaseOrder, SupplierProfile } from '../../models/index.js';
import { supplierListQuery } from './getMyRFQs.controller.js';

/**
 * The PO statuses a supplier sees. Drafts, orders still in approval and
 * rejected ones have not been placed with them.
 */
export const SUPPLIER_VISIBLE_PO_STATUSES = ['approved', 'issued', 'partially_received', 'completed'];

/** The supplier's acknowledgement on an order, if they have made one. */
function acknowledgementBy(order: any, userId: unknown) {
  return (order.approvalHistory || []).find(
    (h: any) => h.action === 'acknowledged' && String(h.by) === String(userId)
  );
}

const getMyPurchaseOrders = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const { page, limit, skip, statuses } = supplierListQuery(req.query, SUPPLIER_VISIBLE_PO_STATUSES);

    const query: any = {
      supplier: profile._id,
      isDeleted: false,
      status: { $in: statuses }
    };

    const [orders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('quotation', 'quotationNumber currency')
        // The approval trail is read only for the supplier's own
        // acknowledgement, and is not sent on.
        .select('poNumber items subtotal vatAmount totalAmount currency status expectedDeliveryDate issuedAt createdAt paymentTerms deliveryAddress approvalHistory')
        .sort({ createdAt: -1, issuedAt: -1 })
        .skip(skip)
        .limit(limit),
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

    // Who approved the order, and when, is procurement's business; the
    // supplier gets only whether (and when) they acknowledged it.
    const ordersWithAcknowledgment = orders.map(order => {
      const { approvalHistory: _history, ...orderObj }: any = order.toObject();
      orderObj.invoice = latestInvoice.get(String(order._id)) || null;
      const acknowledgement = acknowledgementBy(order, req.user!._id);
      orderObj.isAcknowledged = Boolean(acknowledgement);
      orderObj.acknowledgedAt = acknowledgement?.timestamp || null;
      return orderObj;
    });

    res.status(200).json({
      success: true,
      data: ordersWithAcknowledgment,
      pagination: {
        page,
        limit,
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

/**
 * Route guard for the supplier's copy of a PO document: the order must be
 * theirs and in a status they can see. The document itself is rendered by the
 * procurement print controller, so it is the one the supplier was emailed.
 */
export const requireOwnVisiblePurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;
    const profile = await SupplierProfile.findOne({ user: req.user!._id }).select('_id').lean();
    const po =
      profile && mongoose.isValidObjectId(id)
        ? await PurchaseOrder.findOne({
            _id: id,
            supplier: profile._id,
            isDeleted: false,
            status: { $in: SUPPLIER_VISIBLE_PO_STATUSES }
          })
            .select('_id')
            .lean()
        : null;
    // One answer for "not yours" and "not there", so ids cannot be probed.
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }
    next();
  } catch (error: any) {
    console.error('Supplier PO access error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getMyPurchaseOrders;
