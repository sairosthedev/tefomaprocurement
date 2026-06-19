import getPendingApprovals from './getPendingApprovals.controller.js';
import getPurchaseOrderById from './getPurchaseOrderById.controller.js';
import approvePurchaseOrder from './approvePurchaseOrder.controller.js';
import rejectPurchaseOrder from './rejectPurchaseOrder.controller.js';

export default {
  getPendingApprovals,
  getPurchaseOrderById,
  approvePurchaseOrder,
  rejectPurchaseOrder
};
