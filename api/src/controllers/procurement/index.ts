import getSuppliers from './getSuppliers.controller.js';
import getSupplierById from './getSupplierById.controller.js';
import updateSupplier from './updateSupplier.controller.js';
import approveSupplier from './approveSupplier.controller.js';
import blacklistSupplier from './blacklistSupplier.controller.js';
import setSupplierStatus from './setSupplierStatus.controller.js';
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
import updateKysChecklist from './updateKysChecklist.controller.js';
import verifyKys from './verifyKys.controller.js';
import uploadSupplierDocument from './uploadSupplierDocument.controller.js';
import deleteSupplierDocument from './deleteSupplierDocument.controller.js';
import createSupplierEvaluation from './createSupplierEvaluation.controller.js';
import getSupplierEvaluations from './getSupplierEvaluations.controller.js';
import secApproveEvaluation from './secApproveEvaluation.controller.js';
import getEvaluationsDue from './getEvaluationsDue.controller.js';
import getEvaluations from './getEvaluations.controller.js';
import getSupplierReports from './getSupplierReports.controller.js';
import authorizeQuotation from './authorizeQuotation.controller.js';
import approveQuotationWaiver from './approveQuotationWaiver.controller.js';
import cancelPurchaseOrder from './cancelPurchaseOrder.controller.js';
import { getPurchaseOrderCancellationMeta } from './getCancellationMeta.controller.js';
import cancelRequisition from '../department/cancelRequisition.controller.js';

export default {
  getSuppliers,
  getSupplierById,
  updateSupplier,
  approveSupplier,
  blacklistSupplier,
  setSupplierStatus,
  createSupplier,
  bulkImportSuppliers,
  updateKysChecklist,
  verifyKys,
  uploadSupplierDocument,
  deleteSupplierDocument,
  createSupplierEvaluation,
  getSupplierEvaluations,
  secApproveEvaluation,
  getEvaluationsDue,
  getEvaluations,
  getSupplierReports,
  createRFQ,
  getRFQs,
  getRFQById,
  publishRFQ,
  closeRFQ,
  authorizeQuotation,
  approveQuotationWaiver,
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
  updateRequisitionStatus,
  cancelRequisition,
  cancelPurchaseOrder,
  getPurchaseOrderCancellationMeta
};
