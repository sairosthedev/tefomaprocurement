import express from 'express';
import controllers from '../controllers/index.js';
import { protect, authorizeProcurement } from '../middleware/index.js';

const { procurement, department } = controllers;
const router = express.Router();

// Procurement officers, admins, and the head of the Procurement department.
router.use(protect);
router.use(authorizeProcurement);

// Suppliers
router.get('/suppliers', procurement.getSuppliers);
router.post('/suppliers', procurement.createSupplier);
router.post('/suppliers/bulk-import', procurement.bulkImportSuppliers);
router.get('/suppliers/:id', procurement.getSupplierById);
router.put('/suppliers/:id/approve', procurement.approveSupplier);
router.put('/suppliers/:id/blacklist', procurement.blacklistSupplier);
router.put('/suppliers/:id/status', procurement.setSupplierStatus);
router.put('/suppliers/:id/kys', procurement.updateKysChecklist);
router.put('/suppliers/:id/kys/verify', procurement.verifyKys);
router.post('/suppliers/:id/documents', procurement.uploadSupplierDocument);
router.delete('/suppliers/:id/documents/:docId', procurement.deleteSupplierDocument);
router.get('/suppliers/:id/evaluations', procurement.getSupplierEvaluations);
router.post('/suppliers/:id/evaluations', procurement.createSupplierEvaluation);
router.get('/evaluations/due', procurement.getEvaluationsDue);
router.put('/evaluations/:id/sec-approve', procurement.secApproveEvaluation);

// Requisitions (Procurement accepts these - not approves)
router.get('/requisitions', procurement.getPendingRequisitions);
router.get('/requisitions/:id', procurement.getRequisitionById);
router.put('/requisitions/:id/accept', procurement.acceptRequisition);
router.put('/requisitions/:id/reject', procurement.rejectRequisition);
// Procurement may drop unwanted line items or adjust quantities before accepting
router.patch('/requisitions/:id/items/:itemId', department.updateRequisitionItem);
router.delete('/requisitions/:id/items/:itemId', department.removeRequisitionItem);
router.put('/requisitions/:id/sourcing', procurement.updateRequisitionStatus);
router.put('/requisitions/:id/status', procurement.updateRequisitionStatus);

// RFQs
router.post('/rfqs', procurement.createRFQ);
router.get('/rfqs', procurement.getRFQs);
router.get('/rfqs/:id', procurement.getRFQById);
router.put('/rfqs/:id/publish', procurement.publishRFQ);
router.put('/rfqs/:id/close', procurement.closeRFQ);
router.put('/rfqs/:id/authorize-quotation', procurement.authorizeQuotation);
router.put('/rfqs/:id/quotation-waiver', procurement.approveQuotationWaiver);

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
