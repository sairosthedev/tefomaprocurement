const express = require('express');
const router = express.Router();
const { finance } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require finance role
router.use(protect);
router.use(authorize('finance', 'admin'));

// Approvals
router.get('/pending-approvals', finance.getPendingApprovals);
router.get('/purchase-orders', finance.getPurchaseOrders);
router.get('/purchase-orders/:id', finance.getPurchaseOrderById);
router.put('/purchase-orders/:id/approve', finance.approvePurchaseOrder);
router.put('/purchase-orders/:id/reject', finance.rejectPurchaseOrder);

module.exports = router;

