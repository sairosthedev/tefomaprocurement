const getPendingApprovals = require('./getPendingApprovals.controller');
const getPurchaseOrderById = require('./getPurchaseOrderById.controller');
const approvePurchaseOrder = require('./approvePurchaseOrder.controller');

module.exports = {
  getPendingApprovals,
  getPurchaseOrderById,
  approvePurchaseOrder
};

