const getPendingApprovals = require('./getPendingApprovals.controller');
const getPurchaseOrders = require('./getPurchaseOrders.controller');
const getPurchaseOrderById = require('./getPurchaseOrderById.controller');
const approvePurchaseOrder = require('./approvePurchaseOrder.controller');
const rejectPurchaseOrder = require('./rejectPurchaseOrder.controller');

module.exports = {
  getPendingApprovals,
  getPurchaseOrders,
  getPurchaseOrderById,
  approvePurchaseOrder,
  rejectPurchaseOrder
};

