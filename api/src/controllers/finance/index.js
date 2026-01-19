const getPendingApprovals = require('./getPendingApprovals.controller');
const getPurchaseOrders = require('./getPurchaseOrders.controller');
const approvePurchaseOrder = require('./approvePurchaseOrder.controller');
const rejectPurchaseOrder = require('./rejectPurchaseOrder.controller');

module.exports = {
  getPendingApprovals,
  getPurchaseOrders,
  approvePurchaseOrder,
  rejectPurchaseOrder
};

