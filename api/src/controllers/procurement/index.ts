import getSuppliers from './getSuppliers.controller.js';
import getSupplierById from './getSupplierById.controller.js';
import approveSupplier from './approveSupplier.controller.js';
import blacklistSupplier from './blacklistSupplier.controller.js';
import createSupplier from './createSupplier.controller.js';
import bulkImportSuppliers from './bulkImportSuppliers.controller.js';
import createRFQ from './createRFQ.controller.js';
import getRFQs from './getRFQs.controller.js';
import getRFQById from './getRFQById.controller.js';
import publishRFQ from './publishRFQ.controller.js';
import closeRFQ from './closeRFQ.controller.js';
import getQuotations from './getQuotations.controller.js';
import getQuotationById from './getQuotationById.controller.js';
import acceptQuotation from './acceptQuotation.controller.js';
import rejectQuotation from './rejectQuotation.controller.js';
import createPurchaseOrder from './createPurchaseOrder.controller.js';
import getPurchaseOrders from './getPurchaseOrders.controller.js';
import getPurchaseOrderById from './getPurchaseOrderById.controller.js';
import submitPurchaseOrder from './submitPurchaseOrder.controller.js';
import getPendingRequisitions from './getPendingRequisitions.controller.js';
import getRequisitionById from './getRequisitionById.controller.js';
import acceptRequisition from './acceptRequisition.controller.js';
import rejectRequisition from './rejectRequisition.controller.js';
import updateRequisitionStatus from './updateRequisitionStatus.controller.js';

export default {
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
