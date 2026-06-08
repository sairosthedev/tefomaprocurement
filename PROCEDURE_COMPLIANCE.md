# FC-HQ-P-07 Procedure Compliance Report

**Document:** Central Procurement Procedure Rev 9.0 (25.11.2025)  
**System:** fossilProcure  
**Generated:** 2026-06-04

This report maps each major section of FC-HQ-P-07 to the current system implementation status.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Implemented | Matches procedure intent in code |
| 🟡 Partial | Exists but incomplete vs procedure |
| ❌ Missing | Not implemented |
| ➖ N/A | Out of system scope (e.g. petty cash) |

---

## §5 Responsibility & Authority

| Ref | Requirement | Status | System location |
|-----|-------------|--------|-----------------|
| 5.1.2 | Procurement Manager authorizes quotation | ✅ Implemented | `PUT /procurement/rfqs/:id/authorize-quotation` |
| 5.2.1 | HOD selects/approves quotation | ✅ Implemented | `PUT /department/rfqs/:id/select-quotation` + justification |
| 5.2.2 | HOD approves internal/PR requisition | 🟡 Partial | `approveRequisition` records dept-head sign-off; PR flow differs from BuildSmart sequence |
| 5.5 | Supplier visits / vetting | ❌ Missing | No visit records or field evaluation |
| 5.6 | PM + HOD approve consolidated evaluation form | ✅ Implemented | `SupplierEvaluation` + SEC approval (`secApproveEvaluation`) |
| 5.7 | Quarterly supplier review meetings | 🟡 Partial | `nextEvaluationDue` + `getEvaluationsDue`; no meeting/calendar entity |

---

## §6.2 Supplier Selection & Evaluation

| Ref | Requirement | Status | System location |
|-----|-------------|--------|-----------------|
| 6.2.1 | Newspaper invite for onboarding | ❌ Missing | Manual process outside system |
| 6.2.2 | Onboarding framework | 🟡 Partial | Supplier create + KYS checklist |
| 6.2.3 | KYS documents (a–s) | ✅ Implemented | `KYS_CHECKLIST_ITEMS`, `kysChecklist` on `SupplierProfile`, expanded doc types |
| 6.2.4 | Evaluation criteria (credit, pricing, quality…) | ✅ Implemented | `SupplierEvaluation.scores`, `SUPPLIER_EVALUATION_CRITERIA` |
| 6.2.5 | Approved suppliers list | ✅ Implemented | Suppliers with `status: active` after SEC |
| 6.2.6 | Re-evaluation when SEC determines | 🟡 Partial | `evaluationType: re_evaluation`; manual trigger only |
| 6.2.7 | Blacklist reasons | ✅ Implemented | `blacklistSupplier` + reasons align with procedure |

---

## §6.3 Procurement Process

| Ref | Requirement | Status | System location |
|-----|-------------|--------|-----------------|
| 6.3.1 | Check stores before requisition | ✅ Implemented | Submit → `stores_review`; stores queue |
| 6.3.2 | Internal requisition + stores stamp | ✅ Implemented | Fulfill from stock or forward to procurement |
| 6.3.3 | Three quotations from approved suppliers | ✅ Implemented | `MIN_QUOTATIONS_REQUIRED` + enforcement on accept |
| 6.3.4 | HOD justifies quote selection | ✅ Implemented | `hodSelection.justification` on RFQ |
| 6.3.5–6.3.6 | Waiver for <3 quotes | ✅ Implemented | `quotationWaiver` on RFQ + approve endpoint |
| 6.3.7–6.3.10 | PR in system, HOD approval 24h | 🟡 Partial | PR submit/accept exists; timing SLA not enforced |
| 6.3.11 | COO approval above USD 5,000 | ✅ Implemented | `COO_APPROVAL_THRESHOLD_USD`, `requiresCooApproval` |
| 6.3.12 | Approval chain: Proc → HOD → Finance → COO | ✅ Implemented | Sequential PO statuses: `pending_hod` → `pending_finance` → `pending_coo` |
| 6.3.13 | PO conversion | ✅ Implemented | `createPurchaseOrder` from quotation |
| 6.3.14 | PO emailed to supplier | 🟡 Partial | Notifications; no email PO PDF |
| 6.3.15 | Send to Accounts Clerk | ✅ Implemented | Invoice + payment module (AP) |

---

## §6.4–6.5 Cancellations

| Ref | Requirement | Status |
|-----|-------------|--------|
| 6.4.x | Requisition cancellation rules | 🟡 Partial — `cancelled` status exists; auto-cancel rules not implemented |
| 6.5.x | PO cancellation rules | 🟡 Partial — `cancelled` status; formal cancellation workflow missing |

---

## §6.6 Receiving

| Ref | Requirement | Status | System location |
|-----|-------------|--------|-----------------|
| 6.6.1 | PO / delivery note / invoice match | ✅ Implemented | Three-way match on invoice |
| 6.6.2 | Quality checks by dept reps | 🟡 Partial | Delivery `condition` field; no dept rep sign-off |
| 6.6.3 | MSDS for hazardous materials | ❌ Missing | |
| 6.6.4 | Stores receiving procedure | ✅ Implemented | `receiveGoods`, `acceptDelivery` |
| 6.6.7–6.6.9 | Non-conforming returns | 🟡 Partial | Rejection on delivery; 5-day return tracking missing |

---

## §6.8 Compliance / Prohibited Practices

| Ref | Requirement | Status |
|-----|-------------|--------|
| 6.8.1 | No payment without PO | ✅ Enforced — invoices require PO |
| 6.8.2 | VAT registered + tax clearance preference | 🟡 Partial — KYS includes tax clearance; not enforced at PO |
| 6.8.5 | MT + security + SHEQ at receiving | ❌ Missing — role attendance not tracked |

---

## §6.1 Timelines (SLA)

| Process | Procedure SLA | Status |
|---------|---------------|--------|
| Sourcing quotations | 2 days | ❌ Not tracked |
| PR approvals | 1 hour each role | ❌ Not tracked |
| Payment | Tue/Thu | ❌ Not tracked |

---

## Priority backlog (remaining gaps)

### P0
1. **Budget commitment** on PR submit (not in FC-HQ-P-07 detail but critical for spend control)

### P1
2. **PO/PR cancellation workflows** (§6.4–6.5)
3. **RFQ detail UI** for HOD selection / PM authorize / waiver (API ready; enhance `RFQDetail.tsx`)

### P2
7. Supplier visit records (§5.5)
8. SLA / deadline tracking (§6.1.2)
9. MSDS / hazardous materials (§6.6.3)
10. Receiving attendance (MT, security, SHEQ) (§6.8.5)

---

## Recent implementations (this release)

- **§6.2.3 KYS:** Full checklist (19 items), client referrals, document types, verify endpoint
- **§6.2.4–6.2.6 SEC evaluation:** Model, HOD review, SEC approval, quarterly due date
- **§6.3.11–6.3.12 PO approval chain:** HOD → Finance → COO (≥ USD 5,000)
- **§6.6.1 / §6.3.15 AP:** Invoices, three-way match, payments
- **§6.3.1–6.3.2 Stores gate:** `stores_review` → fulfill | forward → procurement
- **§6.3.3–6.3.6 Quotations:** 3-quote rule, waiver, HOD selection, PM authorization
- **Approvals UI:** HOD wired to `/app/approvals`
- **Stores UI:** `/app/stores-pr-review` for PR queue

---

*This document should be reviewed when FC-HQ-P-07 is revised or when major features ship.*
