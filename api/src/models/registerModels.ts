import type { Connection, Model } from 'mongoose';

import User from './User.model.js';
import Site from './Site.model.js';
import Department from './Department.model.js';
import DepartmentBudget from './DepartmentBudget.model.js';
import SupplierProfile from './SupplierProfile.model.js';
import SupplierBankChangeRequest from './SupplierBankChangeRequest.model.js';
import SupplierEvaluation from './SupplierEvaluation.model.js';
import Item from './Item.model.js';
import Inventory from './Inventory.model.js';
import PurchaseRequisition from './PurchaseRequisition.model.js';
import RFQ from './RFQ.model.js';
import Quotation from './Quotation.model.js';
import QuotationEvaluation from './QuotationEvaluation.model.js';
import PurchaseOrder from './PurchaseOrder.model.js';
import Delivery from './Delivery.model.js';
import StoreTransaction from './StoreTransaction.model.js';
import StoreRequisition from './StoreRequisition.model.js';
import StockTransfer from './StockTransfer.model.js';
import Invoice from './Invoice.model.js';
import Payment from './Payment.model.js';
import AuditLog from './AuditLog.model.js';
import Notification from './Notification.model.js';
import OtpChallenge from './OtpChallenge.model.js';

/**
 * Every model that lives in an SBU's own database.
 *
 * Per the multi-entity decision to keep SBUs fully separate, that is all of
 * them — users, suppliers and items included. Nothing here is shared between
 * SBUs, so `populate()` never crosses a database boundary.
 *
 * These are the models compiled on the default connection at import time. We
 * only ever read their `.schema` off them; queries go through the per-SBU
 * copies registered by `registerSbuModels`.
 */
export const SBU_MODELS = {
  User,
  Site,
  Department,
  DepartmentBudget,
  SupplierProfile,
  SupplierBankChangeRequest,
  SupplierEvaluation,
  Item,
  Inventory,
  PurchaseRequisition,
  RFQ,
  Quotation,
  QuotationEvaluation,
  PurchaseOrder,
  Delivery,
  StoreTransaction,
  StoreRequisition,
  StockTransfer,
  Invoice,
  Payment,
  AuditLog,
  Notification,
  OtpChallenge
} as const satisfies Record<string, Model<any>>;

export type SbuModelName = keyof typeof SBU_MODELS;

/**
 * Compile every SBU schema onto `connection`.
 *
 * All of them, eagerly, not just the one being asked for: `populate()` and
 * `ref` lookups resolve the referenced model by name *on the same connection*,
 * so a partially-populated connection fails at the first populate rather than
 * at registration, which is far harder to diagnose.
 */
export function registerSbuModels(connection: Connection): void {
  for (const [name, base] of Object.entries(SBU_MODELS)) {
    if (!connection.models[name]) {
      connection.model(name, base.schema);
    }
  }
}
