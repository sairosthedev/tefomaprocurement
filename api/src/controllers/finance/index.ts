import getPendingApprovals from './getPendingApprovals.controller.js';
import getPurchaseOrders from './getPurchaseOrders.controller.js';
import getPurchaseOrderById from './getPurchaseOrderById.controller.js';
import approvePurchaseOrder from './approvePurchaseOrder.controller.js';
import rejectPurchaseOrder from './rejectPurchaseOrder.controller.js';
import getInvoices from './getInvoices.controller.js';
import getInvoiceById from './getInvoiceById.controller.js';
import approveInvoice from './approveInvoice.controller.js';
import rejectInvoice from './rejectInvoice.controller.js';
import getPayments from './getPayments.controller.js';
import createPayment from './createPayment.controller.js';
import getBudgets from './getBudgets.controller.js';
import upsertDepartmentBudget from './upsertDepartmentBudget.controller.js';
import cancelPurchaseOrder from '../procurement/cancelPurchaseOrder.controller.js';

export default {
  getPendingApprovals,
  getPurchaseOrders,
  getPurchaseOrderById,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  getInvoices,
  getInvoiceById,
  approveInvoice,
  rejectInvoice,
  getPayments,
  createPayment,
  getBudgets,
  upsertDepartmentBudget,
  cancelPurchaseOrder
};
