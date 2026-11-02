import express from 'express';
import type { RequestHandler } from 'express';
import { isProcurementHead } from '@fossil/shared';
import controllers from '../controllers/index.js';
import { protect, authorizeProcurement, adminReadOnly } from '../middleware/index.js';

const { procurement, department } = controllers;
const router = express.Router();

const canReadEvaluations: RequestHandler = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin' || role === 'coo' || role === 'procurement_officer' || isProcurementHead(req.user)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: `Role '${role}' is not authorized to access evaluations`
  });
};

const canSecApproveEvaluation: RequestHandler = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'coo') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: `Role '${role}' is not authorized to approve evaluations`
  });
};

router.use(protect);

// Evaluations — COO can read due list, all evaluations, and SEC-approve.
router.get('/evaluations/due', canReadEvaluations, procurement.getEvaluationsDue);
router.get('/evaluations', canReadEvaluations, procurement.getEvaluations);
router.get('/supplier-reports', canReadEvaluations, procurement.getSupplierReports);
router.put('/evaluations/:id/sec-approve', canSecApproveEvaluation, procurement.secApproveEvaluation);

// Waivers of the three-quotation rule: COO and Head of Procurement only. They
// sit above the procurement guard so the COO can reach them.
const canApproveWaiver: RequestHandler = (req, res, next) => {
  if (req.user?.role === 'coo' || isProcurementHead(req.user)) return next();
  return res.status(403).json({
    success: false,
    message: 'Only the COO or the Head of Procurement can approve a waiver'
  });
};
router.put('/rfqs/:id/quotation-waiver', canApproveWaiver, procurement.approveQuotationWaiver);
router.put('/rfqs/:id/line-awards/waive', canApproveWaiver, procurement.waiveLine);

// Reads the COO needs alongside procurement: the supplier base they oversee,
// and the quotation and line-award views a waiver is decided on. Only these
// GETs; everything that changes a record stays behind the procurement guard.
const canReadSourcing: RequestHandler = (req, res, next) => {
  if (req.user?.role === 'coo') return next();
  return authorizeProcurement(req, res, next);
};
// Constrained to an ObjectId so '/suppliers/match' and
// '/suppliers/invitation-proposal' still reach their own handlers below.
const SUPPLIER_ID = ':id([0-9a-fA-F]{24})';
router.get('/suppliers', canReadSourcing, procurement.getSuppliers);
router.get(`/suppliers/${SUPPLIER_ID}`, canReadSourcing, procurement.getSupplierById);
router.get(`/suppliers/${SUPPLIER_ID}/tier-suggestion`, canReadSourcing, procurement.getSupplierTierSuggestion);
router.get(`/suppliers/${SUPPLIER_ID}/evaluations`, canReadSourcing, procurement.getSupplierEvaluations);
router.get('/quotations/:id', canReadSourcing, procurement.getQuotationById);
router.get('/rfqs/:id/line-awards', canReadSourcing, procurement.getLineAwardMatrix);

// Procurement officers, admins, and the head of the Procurement department.
router.use(authorizeProcurement);

// Cancelling a requisition or PO is deliberately open to admins (see
// PR_CANCEL_BY_ROLE / PO_CANCEL_BY_ROLE), so these sit above the read-only rule.
router.put('/requisitions/:id/cancel', procurement.cancelRequisition);
router.put('/purchase-orders/:id/cancel', procurement.cancelPurchaseOrder);

// Admins may look, but every sourcing decision below belongs to procurement.
router.use(adminReadOnly);

// Suppliers
router.post('/suppliers', procurement.createSupplier);
router.post('/suppliers/bulk-import', procurement.bulkImportSuppliers);
// Category-matched suppliers for RFQ invitation (exact + related). Must precede
// '/suppliers/:id' so 'match' is not read as a supplier id.
router.get('/suppliers/match', procurement.matchSuppliers);
// The invitation list an RFQ would be raised with: exact category matches,
// topped up from related categories to the competitive minimum. Pre-fills the
// Create RFQ screen; the officer edits it before sending.
router.get('/suppliers/invitation-proposal', procurement.getInvitationProposal);
router.put('/suppliers/:id', procurement.updateSupplier);
router.put('/suppliers/:id/approve', procurement.approveSupplier);
router.put('/suppliers/:id/blacklist', procurement.blacklistSupplier);
router.put('/suppliers/:id/status', procurement.setSupplierStatus);
router.put('/suppliers/:id/kys', procurement.updateKysChecklist);
router.put('/suppliers/:id/kys/verify', procurement.verifyKys);
router.post('/suppliers/:id/documents', procurement.uploadSupplierDocument);
router.delete('/suppliers/:id/documents/:docId', procurement.deleteSupplierDocument);
// A human opening the file is what verification means — uploading one is not.
router.put('/suppliers/:id/documents/:docId/verify', procurement.verifySupplierDocument);
// Blacklisting is reversible; reinstatement returns the supplier to pending.
router.put('/suppliers/:id/reinstate', procurement.reinstateSupplier);
// Diligence tier: required KYS depth follows this.
router.put('/suppliers/:id/tier', procurement.setSupplierTier);
router.post('/suppliers/:id/evaluations', procurement.createSupplierEvaluation);

// Supplier banking changes: held, verified by callback, then approved by a
// second person. Payments to the supplier pause while a request is open.
router.get('/bank-changes', procurement.getBankChangeRequests);
router.put('/bank-changes/:id/verify-callback', procurement.verifyBankChangeCallback);
router.put('/bank-changes/:id/approve', procurement.approveBankChange);
router.put('/bank-changes/:id/reject', procurement.rejectBankChange);

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
// Procurement selects the winner (formerly the department head's step).
router.put('/rfqs/:id/select-quotation', procurement.selectQuotation);
router.put('/rfqs/:id/authorize-quotation', procurement.authorizeQuotation);
// The Head of Procurement's queue: selections (whole-quote and per-line)
// still waiting on their authorization.
router.get('/authorizations/pending', procurement.getPendingAuthorizations);

// Per-line (split) award — compare bids by line and award to different suppliers.
// Selection, PM authorization and per-line waivers are all procurement actions.
// Weighted ranking of whole responses, supplier against supplier. Honours the
// sealed-bid rule: empty until the deadline passes or the RFQ is closed.
router.get('/rfqs/:id/ranking', procurement.getRfqRanking);
router.put('/rfqs/:id/line-awards/select', procurement.selectLine);
router.put('/rfqs/:id/line-awards/pm-authorize', procurement.pmAuthorizeLine);
router.post('/rfqs/:id/line-awards/generate-pos', procurement.generateLineAwardPOs);
router.post('/rfqs/:id/line-awards/resource-unawarded', procurement.resourceUnawardedLines);

// Quotations
router.get('/quotations', procurement.getQuotations);
router.put('/quotations/:id/accept', procurement.acceptQuotation);
router.put('/quotations/:id/reject', procurement.rejectQuotation);
router.put('/quotations/:id/request-revision', procurement.requestQuotationRevision);

// Purchase Orders
router.post('/purchase-orders', procurement.createPurchaseOrder);
router.get('/purchase-orders', procurement.getPurchaseOrders);
router.get('/purchase-orders/cancellation-meta', procurement.getPurchaseOrderCancellationMeta);
router.get('/purchase-orders/:id', procurement.getPurchaseOrderById);
// Rev 9 clause 6.3.14: the formal PO document, as sent to the supplier.
router.get('/purchase-orders/:id/print', procurement.printPurchaseOrder);
router.put('/purchase-orders/:id/submit', procurement.submitPurchaseOrder);

export default router;
