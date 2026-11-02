import express from 'express';
import controllers from '../controllers/index.js';
import { protect, authorize } from '../middleware/index.js';

const { coo } = controllers;
const router = express.Router();

// COO only. Admins run the system, not approvals.
router.use(protect);
router.use(authorize('coo'));

// Approvals
router.get('/pending-approvals', coo.getPendingApprovals);
router.get('/purchase-orders/:id', coo.getPurchaseOrderById);
router.put('/purchase-orders/:id/approve', coo.approvePurchaseOrder);
router.put('/purchase-orders/:id/reject', coo.rejectPurchaseOrder);
router.put('/purchase-orders/:id/cancel', coo.cancelPurchaseOrder);

export default router;
