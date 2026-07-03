import express from 'express';
import controllers from '../controllers/index.js';
import { protect, authorize } from '../middleware/index.js';

const { coo } = controllers;
const router = express.Router();

// All routes require COO role
router.use(protect);
router.use(authorize('coo', 'admin'));

// Approvals
router.get('/pending-approvals', coo.getPendingApprovals);
router.get('/purchase-orders/:id', coo.getPurchaseOrderById);
router.put('/purchase-orders/:id/approve', coo.approvePurchaseOrder);
router.put('/purchase-orders/:id/reject', coo.rejectPurchaseOrder);
router.put('/purchase-orders/:id/cancel', coo.cancelPurchaseOrder);

export default router;
