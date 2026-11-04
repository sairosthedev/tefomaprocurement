import express from 'express';
import controllers from '../controllers/index.js';
import getKysDocumentFile from '../controllers/supplier/getKysDocumentFile.controller.js';
import { requireOwnVisiblePurchaseOrder } from '../controllers/supplier/getMyPurchaseOrders.controller.js';
import { protect, authorize } from '../middleware/index.js';

const { supplier, procurement } = controllers;
const router = express.Router();

// All routes require supplier role
router.use(protect);
router.use(authorize('supplier'));

// Profile
router.get('/profile', supplier.getMyProfile);
router.put('/profile', supplier.updateProfile);

// KYS compliance documents (self-service upload)
router.post('/kys/documents', supplier.uploadKysDocument);
router.delete('/kys/documents/:docId', supplier.deleteKysDocument);
// The file itself, fetched when the supplier opens a document.
router.get('/kys/documents/:docId([0-9a-fA-F]{24})/file', getKysDocumentFile);

// RFQs
router.get('/rfqs', supplier.getMyRFQs);
router.get('/rfqs/:id', supplier.getRFQById);

// Quotations
router.post('/quotations', supplier.submitQuotation);
router.get('/quotations', supplier.getMyQuotations);

// Purchase Orders
router.get('/purchase-orders', supplier.getMyPurchaseOrders);
router.put('/purchase-orders/:id/acknowledge', supplier.acknowledgePurchaseOrder);
// The order document: the same PDF procurement prints and emails, for the
// supplier's own orders only.
router.get('/purchase-orders/:id/print', requireOwnVisiblePurchaseOrder, procurement.printPurchaseOrder);

// Deliveries
router.get('/deliveries', supplier.getMyDeliveries);

// Invoices
router.get('/invoices', supplier.getMyInvoices);
router.post('/invoices', supplier.submitInvoice);

export default router;
