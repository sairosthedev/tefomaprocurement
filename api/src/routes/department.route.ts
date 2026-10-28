import express from 'express';
import controllers from '../controllers/index.js';
import { protect, authorize } from '../middleware/index.js';

const { department } = controllers;
const router = express.Router();

router.use(protect);

// Requisitions — end users raise/manage their own; HODs manage the department's.
// Admins can read them but never raise, submit or approve one.
const requester = authorize('end_user', 'department_head');
const reader = authorize('end_user', 'department_head', 'admin');
router.get('/catalog-items', requester, department.searchCatalogItems);
router.post('/requisitions', requester, department.createRequisition);
router.get('/requisitions', reader, department.getRequisitions);
router.get('/requisitions/cancellation-meta', reader, department.getRequisitionCancellationMeta);
router.get('/requisitions/:id', reader, department.getRequisitionById);
router.put('/requisitions/:id/submit', requester, department.submitRequisition);

// HOD approval gate on requisitions
const hod = authorize('department_head');
router.put('/requisitions/:id/approve', hod, department.approveRequisition);
router.put('/requisitions/:id/reject', hod, department.rejectRequisition);
// Admin keeps cancel: PR_CANCEL_BY_ROLE grants it deliberately.
router.put('/requisitions/:id/cancel', reader, department.cancelRequisition);
// Approver may drop unwanted line items or adjust quantities before approving
router.patch('/requisitions/:id/items/:itemId', hod, department.updateRequisitionItem);
router.delete('/requisitions/:id/items/:itemId', hod, department.removeRequisitionItem);

// Store Requisitions
router.post('/store-requisitions', hod, department.createStoreRequisition);
router.get('/store-requisitions', hod, department.getStoreRequisitions);

// PO approvals (HOD step)
router.get('/pending-po-approvals', hod, department.getPendingPoApprovals);
router.put('/purchase-orders/:id/approve', hod, department.approvePurchaseOrder);
router.put('/purchase-orders/:id/proc-approve', hod, department.procApprovePurchaseOrder);
router.put('/purchase-orders/:id/reject', hod, department.rejectPurchaseOrder);

// Supplier evaluation HOD review
router.get('/evaluations/pending', hod, department.getPendingEvaluations);
router.put('/evaluations/:id/review', hod, department.hodReviewEvaluation);

export default router;
