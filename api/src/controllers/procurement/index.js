const getSuppliers = require('./getSuppliers.controller');
const getSupplierById = require('./getSupplierById.controller');
const approveSupplier = require('./approveSupplier.controller');
const blacklistSupplier = require('./blacklistSupplier.controller');
const createRFQ = require('./createRFQ.controller');
const getRFQs = require('./getRFQs.controller');
const publishRFQ = require('./publishRFQ.controller');
const getQuotations = require('./getQuotations.controller');
const createPurchaseOrder = require('./createPurchaseOrder.controller');
const getPurchaseOrders = require('./getPurchaseOrders.controller');

module.exports = {
  getSuppliers,
  getSupplierById,
  approveSupplier,
  blacklistSupplier,
  createRFQ,
  getRFQs,
  publishRFQ,
  getQuotations,
  createPurchaseOrder,
  getPurchaseOrders
};

