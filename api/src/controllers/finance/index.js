const getPendingApprovals = require('./getPendingApprovals.controller');
const approvePurchaseOrder = require('./approvePurchaseOrder.controller');
const rejectPurchaseOrder = require('./rejectPurchaseOrder.controller');

module.exports = {
  getPendingApprovals,
  approvePurchaseOrder,
  rejectPurchaseOrder
};

