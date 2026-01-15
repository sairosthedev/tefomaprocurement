const express = require('express');
const router = express.Router();
const { procurement } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require procurement officer or admin role
router.use(protect);
router.use(authorize('procurement_officer', 'admin'));

// Suppliers
router.get('/suppliers', procurement.getSuppliers);
router.post('/suppliers', procurement.createSupplier);
router.post('/suppliers/bulk-import', procurement.bulkImportSuppliers);
router.get('/suppliers/:id', procurement.getSupplierById);
router.put('/suppliers/:id/approve', procurement.approveSupplier);
router.put('/suppliers/:id/blacklist', procurement.blacklistSupplier);

// RFQs
router.post('/rfqs', procurement.createRFQ);
router.get('/rfqs', procurement.getRFQs);
router.put('/rfqs/:id/publish', procurement.publishRFQ);

// Quotations
router.get('/quotations', procurement.getQuotations);

// Purchase Orders
router.post('/purchase-orders', procurement.createPurchaseOrder);
router.get('/purchase-orders', procurement.getPurchaseOrders);

module.exports = router;

