import type { Request, Response } from 'express';
import type mongoose from 'mongoose';
import {
  PurchaseRequisition,
  RFQ,
  Quotation,
  QuotationEvaluation,
  PurchaseOrder,
  Delivery,
  Invoice,
  Payment,
  StoreRequisition,
  StoreTransaction,
  StockTransfer,
  SupplierEvaluation,
  Notification
} from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const CONFIRM_PHRASE = 'DELETE ALL RECORDS';

// Transactional collections only. Master data (User, SupplierProfile, Department,
// Site, Inventory, Item, DepartmentBudget) and the AuditLog trail are preserved so
// the system stays usable for a fresh test run.
const TRANSACTIONAL: { name: string; model: mongoose.Model<any> }[] = [
  { name: 'PurchaseRequisition', model: PurchaseRequisition },
  { name: 'RFQ', model: RFQ },
  { name: 'Quotation', model: Quotation },
  { name: 'QuotationEvaluation', model: QuotationEvaluation },
  { name: 'PurchaseOrder', model: PurchaseOrder },
  { name: 'Delivery', model: Delivery },
  { name: 'Invoice', model: Invoice },
  { name: 'Payment', model: Payment },
  { name: 'StoreRequisition', model: StoreRequisition },
  { name: 'StoreTransaction', model: StoreTransaction },
  { name: 'StockTransfer', model: StockTransfer },
  { name: 'SupplierEvaluation', model: SupplierEvaluation },
  { name: 'Notification', model: Notification }
];

/**
 * Danger: permanently deletes ALL transactional records to give a clean testing
 * slate. Keeps users, supplier profiles, departments, sites, inventory, items and
 * budgets. Requires an admin and an explicit confirmation phrase in the body.
 */
const resetTransactions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { confirm } = req.body ?? {};
    if (confirm !== CONFIRM_PHRASE) {
      return res.status(400).json({
        success: false,
        message: `Confirmation required. Send { "confirm": "${CONFIRM_PHRASE}" } to proceed.`
      });
    }

    const deleted: Record<string, number> = {};
    let total = 0;
    for (const { name, model } of TRANSACTIONAL) {
      const { deletedCount } = await model.deleteMany({});
      deleted[name] = deletedCount ?? 0;
      total += deletedCount ?? 0;
    }

    // AuditLog is preserved, so this record survives the wipe as evidence.
    await createAuditLog({
      action: 'delete',
      entity: 'System',
      user: req.user,
      description: `Admin reset all transactional records (${total} documents removed)`,
      newData: { deleted, total },
      req
    });

    return res.status(200).json({
      success: true,
      message: `Reset complete — ${total} transactional records removed. Users, supplier profiles, departments and sites were kept.`,
      data: { total, deleted, kept: ['User', 'SupplierProfile', 'Department', 'Site', 'Inventory', 'Item', 'DepartmentBudget', 'AuditLog'] }
    });
  } catch (error: any) {
    console.error('Reset transactions error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default resetTransactions;
