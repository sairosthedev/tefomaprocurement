const express = require('express');
const router = express.Router();
const { finance, procurement } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require finance role
router.use(protect);
router.use(authorize('finance', 'admin'));

// Approvals
router.get('/pending-approvals', finance.getPendingApprovals);
router.get('/purchase-orders', finance.getPurchaseOrders);
router.get('/purchase-orders/:id/pdf', procurement.downloadPurchaseOrderPDF);
router.put('/purchase-orders/:id/approve', finance.approvePurchaseOrder);
router.put('/purchase-orders/:id/reject', finance.rejectPurchaseOrder);

module.exports = router;

