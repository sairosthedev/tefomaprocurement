import express from 'express';
import controllers from '../controllers/index.js';
import { protect, authorize } from '../middleware/index.js';

const { department } = controllers;
const router = express.Router();

router.use(protect);

// Requisitions — end users raise/manage their own; HOD/admin manage the department's
const requester = authorize('end_user', 'department_head', 'admin');
router.post('/requisitions', requester, department.createRequisition);
router.get('/requisitions', requester, department.getRequisitions);
router.get('/requisitions/:id', requester, department.getRequisitionById);
router.put('/requisitions/:id/submit', requester, department.submitRequisition);

// HOD approval gate on requisitions (FC-HQ-P-07 §6.3.2)
const hod = authorize('department_head', 'admin');
router.put('/requisitions/:id/approve', hod, department.approveRequisition);
router.put('/requisitions/:id/reject', hod, department.rejectRequisition);

// Store Requisitions
router.post('/store-requisitions', hod, department.createStoreRequisition);
router.get('/store-requisitions', hod, department.getStoreRequisitions);

// PO approvals (FC-HQ-P-07 §6.3.12 — HOD step)
router.get('/pending-po-approvals', hod, department.getPendingPoApprovals);
router.put('/purchase-orders/:id/approve', hod, department.approvePurchaseOrder);

// Supplier evaluation HOD review (§6.2.4)
router.put('/evaluations/:id/review', hod, department.hodReviewEvaluation);

// HOD quotation selection (§6.3.4)
router.put('/rfqs/:id/select-quotation', hod, department.hodSelectQuotation);

export default router;
