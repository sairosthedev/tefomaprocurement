const express = require('express');
const router = express.Router();
const { coo } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require COO role
router.use(protect);
router.use(authorize('coo', 'admin'));

// Approvals
router.get('/pending-approvals', coo.getPendingApprovals);
router.get('/purchase-orders/:id', coo.getPurchaseOrderById);
router.put('/purchase-orders/:id/approve', coo.approvePurchaseOrder);

module.exports = router;

