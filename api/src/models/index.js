const User = require('./User.model');
const Department = require('./Department.model');
const SupplierProfile = require('./SupplierProfile.model');
const Item = require('./Item.model');
const Inventory = require('./Inventory.model');
const PurchaseRequisition = require('./PurchaseRequisition.model');
const RFQ = require('./RFQ.model');
const Quotation = require('./Quotation.model');
const QuotationEvaluation = require('./QuotationEvaluation.model');
const PurchaseOrder = require('./PurchaseOrder.model');
const Delivery = require('./Delivery.model');
const StoreTransaction = require('./StoreTransaction.model');
const StoreRequisition = require('./StoreRequisition.model');
const AuditLog = require('./AuditLog.model');
const Notification = require('./Notification.model');

module.exports = {
  User,
  Department,
  SupplierProfile,
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
  AuditLog,
  Notification
};

