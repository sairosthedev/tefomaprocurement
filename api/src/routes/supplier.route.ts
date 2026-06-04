import express from 'express';
import controllers from '../controllers/index.js';
import { protect, authorize } from '../middleware/index.js';

const { supplier } = controllers;
const router = express.Router();

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
router.put('/purchase-orders/:id/acknowledge', supplier.acknowledgePurchaseOrder);

// Deliveries
router.get('/deliveries', supplier.getMyDeliveries);

export default router;
