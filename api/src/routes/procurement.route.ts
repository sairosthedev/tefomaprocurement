import express from 'express';
import controllers from '../controllers/index.js';
import { protect, authorize } from '../middleware/index.js';

const { procurement } = controllers;
const router = express.Router();

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
router.put('/rfqs/:id/close', procurement.closeRFQ);

// Quotations
router.get('/quotations', procurement.getQuotations);
router.get('/quotations/:id', procurement.getQuotationById);
router.put('/quotations/:id/accept', procurement.acceptQuotation);
router.put('/quotations/:id/reject', procurement.rejectQuotation);

// Purchase Orders
router.post('/purchase-orders', procurement.createPurchaseOrder);
router.get('/purchase-orders', procurement.getPurchaseOrders);
router.get('/purchase-orders/:id', procurement.getPurchaseOrderById);
router.put('/purchase-orders/:id/submit', procurement.submitPurchaseOrder);

export default router;
