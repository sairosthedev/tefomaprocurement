const express = require('express');
const router = express.Router();
const { supplier } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require supplier role
router.use(protect);
router.use(authorize('supplier'));

// Profile
router.get('/profile', supplier.getMyProfile);
router.put('/profile', supplier.updateProfile);

// RFQs
router.get('/rfqs', supplier.getMyRFQs);

// Quotations
router.post('/quotations', supplier.submitQuotation);
router.get('/quotations', supplier.getMyQuotations);

// Purchase Orders
router.get('/purchase-orders', supplier.getMyPurchaseOrders);

module.exports = router;

