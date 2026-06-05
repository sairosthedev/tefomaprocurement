import createRequisition from './createRequisition.controller.js';
import getRequisitions from './getRequisitions.controller.js';
import getRequisitionById from './getRequisitionById.controller.js';
import submitRequisition from './submitRequisition.controller.js';
import approveRequisition from './approveRequisition.controller.js';
import rejectRequisition from './rejectRequisition.controller.js';
import createStoreRequisition from './createStoreRequisition.controller.js';
import getStoreRequisitions from './getStoreRequisitions.controller.js';
import approvePurchaseOrder from './approvePurchaseOrder.controller.js';
import getPendingPoApprovals from './getPendingPoApprovals.controller.js';
import hodReviewEvaluation from './hodReviewEvaluation.controller.js';
import hodSelectQuotation from './hodSelectQuotation.controller.js';

export default {
  createRequisition,
  getRequisitions,
  getRequisitionById,
  submitRequisition,
  approveRequisition,
  rejectRequisition,
  createStoreRequisition,
  getStoreRequisitions,
  approvePurchaseOrder,
  getPendingPoApprovals,
  hodReviewEvaluation,
  hodSelectQuotation
};
