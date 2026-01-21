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
const getQuotationById = require('./getQuotationById.controller');
const acceptQuotation = require('./acceptQuotation.controller');
const rejectQuotation = require('./rejectQuotation.controller');
const createPurchaseOrder = require('./createPurchaseOrder.controller');
const getPurchaseOrders = require('./getPurchaseOrders.controller');
const submitPurchaseOrder = require('./submitPurchaseOrder.controller');
const getPendingRequisitions = require('./getPendingRequisitions.controller');
const acceptRequisition = require('./acceptRequisition.controller');
const rejectRequisition = require('./rejectRequisition.controller');
const updateRequisitionStatus = require('./updateRequisitionStatus.controller');

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
  getQuotationById,
  acceptQuotation,
  rejectQuotation,
  createPurchaseOrder,
  getPurchaseOrders,
  submitPurchaseOrder,
  getPendingRequisitions,
  acceptRequisition,
  rejectRequisition,
  updateRequisitionStatus
};

