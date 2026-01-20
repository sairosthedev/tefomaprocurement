const express = require('express');
const router = express.Router();
const { procurement } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require authentication
router.use(protect);

// Purchase Orders - View routes (allow finance and COO to view, must be before general authorize)
router.get('/purchase-orders', authorize('procurement_officer', 'admin', 'finance', 'coo'), procurement.getPurchaseOrders);
router.get('/purchase-orders/:id', authorize('procurement_officer', 'admin', 'finance', 'coo'), procurement.getPurchaseOrderById);
router.get('/purchase-orders/:id/pdf', authorize('procurement_officer', 'admin', 'finance', 'coo'), procurement.downloadPurchaseOrderPDF);

// Routes that require procurement officer or admin role
router.use(authorize('procurement_officer', 'admin'));

// Suppliers
router.get('/suppliers', procurement.getSuppliers);
router.post('/suppliers', procurement.createSupplier);
router.post('/suppliers/bulk-import', procurement.bulkImportSuppliers);
router.get('/suppliers/:id', procurement.getSupplierById);
router.put('/suppliers/:id/approve', procurement.approveSupplier);
router.put('/suppliers/:id/blacklist', procurement.blacklistSupplier);

// Requisitions (Procurement accepts these - not approves)
router.get('/requisitions', procurement.getPendingRequisitions);
router.get('/requisitions/:id', procurement.getRequisitionById);
router.put('/requisitions/:id/accept', procurement.acceptRequisition);
router.put('/requisitions/:id/reject', procurement.rejectRequisition);
router.put('/requisitions/:id/sourcing', procurement.updateRequisitionStatus);
router.put('/requisitions/:id/status', procurement.updateRequisitionStatus);

// RFQs
router.post('/rfqs', procurement.createRFQ);
router.get('/rfqs', procurement.getRFQs);
router.get('/rfqs/:id', procurement.getRFQById);
router.put('/rfqs/:id/publish', procurement.publishRFQ);

// Quotations
router.get('/quotations', procurement.getQuotations);
router.get('/quotations/:id', procurement.getQuotationById);
router.put('/quotations/:id/accept', procurement.acceptQuotation);
router.put('/quotations/:id/reject', procurement.rejectQuotation);

// Purchase Orders - Create and submit require procurement/admin
router.post('/purchase-orders', procurement.createPurchaseOrder);
router.put('/purchase-orders/:id/submit', procurement.submitPurchaseOrder);

module.exports = router;

