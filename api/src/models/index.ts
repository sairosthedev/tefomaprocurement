/**
 * Model resolvers.
 *
 * Every export here is a proxy that resolves, per request, to the model
 * compiled on the current SBU's database connection. Call sites are unchanged:
 * `import { PurchaseOrder } from '../models/index.js'` still works, but the
 * query now runs against whichever SBU the request belongs to.
 *
 * There is deliberately no "every SBU" export. Group views fan out over the
 * registry explicitly, so a cross-SBU read is always a visible decision.
 */
import { connectionForSbu } from '../tenancy/connections.js';
import { requireSbu } from '../tenancy/sbuContext.js';
import { resolvingModel } from './modelProxy.js';
import { SBU_MODELS } from './registerModels.js';

const sbuConnection = (): ReturnType<typeof connectionForSbu> => connectionForSbu(requireSbu());

export const User = resolvingModel(SBU_MODELS.User, sbuConnection);
export const Site = resolvingModel(SBU_MODELS.Site, sbuConnection);
export const Department = resolvingModel(SBU_MODELS.Department, sbuConnection);
export const DepartmentBudget = resolvingModel(SBU_MODELS.DepartmentBudget, sbuConnection);
export const SupplierProfile = resolvingModel(SBU_MODELS.SupplierProfile, sbuConnection);
export const SupplierBankChangeRequest = resolvingModel(
  SBU_MODELS.SupplierBankChangeRequest,
  sbuConnection
);
export const SupplierEvaluation = resolvingModel(SBU_MODELS.SupplierEvaluation, sbuConnection);
export const Item = resolvingModel(SBU_MODELS.Item, sbuConnection);
export const Inventory = resolvingModel(SBU_MODELS.Inventory, sbuConnection);
export const PurchaseRequisition = resolvingModel(SBU_MODELS.PurchaseRequisition, sbuConnection);
export const RFQ = resolvingModel(SBU_MODELS.RFQ, sbuConnection);
export const Quotation = resolvingModel(SBU_MODELS.Quotation, sbuConnection);
export const QuotationEvaluation = resolvingModel(SBU_MODELS.QuotationEvaluation, sbuConnection);
export const PurchaseOrder = resolvingModel(SBU_MODELS.PurchaseOrder, sbuConnection);
export const Delivery = resolvingModel(SBU_MODELS.Delivery, sbuConnection);
export const StoreTransaction = resolvingModel(SBU_MODELS.StoreTransaction, sbuConnection);
export const StoreRequisition = resolvingModel(SBU_MODELS.StoreRequisition, sbuConnection);
export const StockTransfer = resolvingModel(SBU_MODELS.StockTransfer, sbuConnection);
export const Invoice = resolvingModel(SBU_MODELS.Invoice, sbuConnection);
export const Payment = resolvingModel(SBU_MODELS.Payment, sbuConnection);
export const AuditLog = resolvingModel(SBU_MODELS.AuditLog, sbuConnection);
export const Notification = resolvingModel(SBU_MODELS.Notification, sbuConnection);
export const OtpChallenge = resolvingModel(SBU_MODELS.OtpChallenge, sbuConnection);

/** Group-wide registry, in the platform database rather than any SBU's. */
export { default as Sbu } from './Sbu.model.js';
