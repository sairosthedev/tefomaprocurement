const getSuppliers = require('./getSuppliers.controller');
const getSupplierById = require('./getSupplierById.controller');
const approveSupplier = require('./approveSupplier.controller');
const blacklistSupplier = require('./blacklistSupplier.controller');
const createSupplier = require('./createSupplier.controller');
const bulkImportSuppliers = require('./bulkImportSuppliers.controller');
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
  createSupplier,
  bulkImportSuppliers,
  createRFQ,
  getRFQs,
  publishRFQ,
  getQuotations,
  createPurchaseOrder,
  getPurchaseOrders
};

