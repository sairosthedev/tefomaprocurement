import mongoose from 'mongoose';
import { Invoice, PurchaseOrder } from '../models/index.js';

export async function syncPurchaseOrderFinancials(
  poId: mongoose.Types.ObjectId | string
): Promise<void> {
  const invoices = await Invoice.find({
    purchaseOrder: poId,
    isDeleted: false,
    status: { $nin: ['rejected', 'cancelled', 'draft'] }
  });

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);

  await PurchaseOrder.findByIdAndUpdate(poId, { totalInvoiced, totalPaid });
}
