import express from 'express';
import controllers from '../controllers/index.js';
import { protect, authorize } from '../middleware/index.js';

const { finance } = controllers;
const router = express.Router();

// All routes require finance role
router.use(protect);
router.use(authorize('finance', 'admin'));

// Approvals
router.get('/pending-approvals', finance.getPendingApprovals);
router.get('/purchase-orders', finance.getPurchaseOrders);
router.get('/purchase-orders/:id', finance.getPurchaseOrderById);
router.put('/purchase-orders/:id/approve', finance.approvePurchaseOrder);
router.put('/purchase-orders/:id/reject', finance.rejectPurchaseOrder);

// Accounts payable
router.get('/invoices', finance.getInvoices);
router.get('/invoices/:id', finance.getInvoiceById);
router.put('/invoices/:id/approve', finance.approveInvoice);
router.put('/invoices/:id/reject', finance.rejectInvoice);
router.get('/payments', finance.getPayments);
router.post('/payments', finance.createPayment);

export default router;
