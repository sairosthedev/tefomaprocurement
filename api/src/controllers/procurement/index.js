const getSuppliers = require('./getSuppliers.controller');
const getSupplierById = require('./getSupplierById.controller');
const approveSupplier = require('./approveSupplier.controller');
const blacklistSupplier = require('./blacklistSupplier.controller');
const createSupplier = require('./createSupplier.controller');
const bulkImportSuppliers = require('./bulkImportSuppliers.controller');
const createRFQ = require('./createRFQ.controller');
const getRFQs = require('./getRFQs.controller');
const getRFQById = require('./getRFQById.controller');
const publishRFQ = require('./publishRFQ.controller');
const closeRFQ = require('./closeRFQ.controller');
const getQuotations = require('./getQuotations.controller');
const getQuotationById = require('./getQuotationById.controller');
const acceptQuotation = require('./acceptQuotation.controller');
const rejectQuotation = require('./rejectQuotation.controller');
const createPurchaseOrder = require('./createPurchaseOrder.controller');
const getPurchaseOrders = require('./getPurchaseOrders.controller');
const getPurchaseOrderById = require('./getPurchaseOrderById.controller');
const submitPurchaseOrder = require('./submitPurchaseOrder.controller');
const getPendingRequisitions = require('./getPendingRequisitions.controller');
const getRequisitionById = require('./getRequisitionById.controller');
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
  getRFQById,
  publishRFQ,
  closeRFQ,
  getQuotations,
  getQuotationById,
  acceptQuotation,
  rejectQuotation,
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  submitPurchaseOrder,
  getPendingRequisitions,
  getRequisitionById,
  acceptRequisition,
  rejectRequisition,
  updateRequisitionStatus
};

