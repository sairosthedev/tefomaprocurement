const express = require('express');
const router = express.Router();
const { supplier, procurement } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require supplier role
router.use(protect);
router.use(authorize('supplier'));

// Profile
router.get('/profile', supplier.getMyProfile);
router.put('/profile', supplier.updateProfile);

// RFQs
router.get('/rfqs', supplier.getMyRFQs);
router.get('/rfqs/:id', supplier.getRFQById);

// Quotations
router.post('/quotations', supplier.submitQuotation);
router.get('/quotations', supplier.getMyQuotations);

// Purchase Orders
router.get('/purchase-orders', supplier.getMyPurchaseOrders);
router.get('/purchase-orders/:id', supplier.getMyPurchaseOrderById);
router.get('/purchase-orders/:id/pdf', procurement.downloadPurchaseOrderPDF);
router.put('/purchase-orders/:id/acknowledge', supplier.acknowledgePurchaseOrder);

// Deliveries
router.get('/deliveries', supplier.getMyDeliveries);

module.exports = router;

