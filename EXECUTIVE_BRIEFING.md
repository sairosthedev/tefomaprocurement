# Tefoma Procurement — Executive Briefing

**Audience:** CEO, investors, senior management
**System:** Tefoma Procurement (formerly fossilProcure) for Tefoma Construction
**Live application:** https://tefomaprocurement.vercel.app
**Prepared:** 3 September 2026, from the code as it stands on the `main` branch

This document explains what the system is, the business problem it solves, how a purchase moves through it, the controls it enforces, what has been built and tested, and what remains. Every statement is drawn from the current codebase, not from a plan.

---

## 1. In one paragraph

Tefoma Procurement is a web-based procure-to-pay and stores platform. It takes a purchase from the moment a site or department needs something, through stock checking, competitive quotation, layered approval, delivery into stores, and finally supplier invoice and payment, in one system with a full audit trail. It replaces paper requisitions, emailed quotes and spreadsheet tracking. Eight roles use it, including external suppliers through their own portal. It encodes Tefoma's own Central Procurement Procedure (Rev 9) as enforced rules rather than guidance.

---

## 2. The problem it solves

| Before | With the system |
|---|---|
| Paper requisitions walk between offices; status is unknown | Every request has a number, a status and an owner, visible in real time |
| Stores is bypassed and items already in stock get bought again | Every approved request is checked against stock before procurement sees it |
| Quotes arrive by email and can be altered or lost | Suppliers submit quotes into the system; each version is locked and timestamped |
| Approval authority depends on who signs a paper | Approval chain is enforced in code: HOD, Procurement HOD, Finance, then COO above USD 5,000 |
| Invoices paid without checking what was ordered or received | Three-way match of order, goods received voucher and invoice before Finance can approve |
| Unvetted suppliers can trade with the company | Suppliers stay "pending" until a 19-item Know Your Supplier checklist is verified |
| Audit means reconstructing history from files | Every create, approve, reject, upload and login is logged with user, time and IP address |

---

## 3. How a purchase moves through the system

```
End user raises requisition (with equipment make/model/serial and photos where needed)
        ↓
Department Head approves or rejects
        ↓
Stores checks stock → issues from stock, or forwards the shortfall to procurement
        ↓
Procurement accepts → creates RFQ → invites approved suppliers in matching categories
        ↓
Suppliers quote through the portal (procurement can request a price revision)
        ↓
Award per line: HOD selects with justification, Procurement Manager authorises
        ↓
Purchase orders generated (one per winning supplier)
        ↓
Approvals: requesting-dept HOD → Procurement HOD → Finance → COO (≥ USD 5,000)
        ↓
Supplier acknowledges and delivers → Stores receives, inspects, prints GRV → stock updated
        ↓
Supplier submits invoice → three-way match → Finance approves → payment recorded
```

Requests fully satisfied from stock stop at the stores step. Lines that receive no quotes are tracked and re-sourced in a new RFQ rather than silently lost.

---

## 4. Who uses it

| Role | What they do in the system |
|---|---|
| End User | Raises purchase requisitions for their department; sees only their own |
| Department Head | Approves requisitions and purchase orders for the department; selects winning quotes with justification |
| Stores Officer | Reviews requisitions against stock, receives deliveries, prints GRVs, manages inventory and inter-site transfers |
| Procurement Officer | Suppliers and KYS, RFQs, quotations, awards, purchase orders, evaluations |
| Procurement Head | A Department Head of the Procurement department; additionally authorises quotations and approves POs as the second HOD step |
| Finance Manager | Department budgets, financial PO approval, invoices, payments |
| Chief Operating Officer | Final approval for orders at or above USD 5,000; oversight reports |
| Supplier (external) | Own profile and compliance documents, RFQ invitations, quotations, orders, deliveries, invoices |
| System Administrator | Users, departments, sites, audit logs, full oversight |

Every login requires email, password and a one-time code sent to the user's inbox.

---

## 5. Modules

### 5.1 Purchase requisitions
Line items from the stock catalogue or free text, priority, delivery site, and optional equipment identity (make, model, serial, data-plate photo) so plant spares can be quoted accurately. Department Head approval, cancellation with coded reasons and downstream clean-up of any RFQ or PO.

### 5.2 Stores gate
Approved requisitions land in a stores queue. Stores issues what is on hand, checks other sites for transferable stock, and forwards only the shortfall to procurement. This mirrors the paper "quantity delivered" column and is the main defence against re-buying stock.

### 5.3 Sourcing and quotations
RFQs are built from requisitions. The system suggests approved suppliers whose categories match the lines. Suppliers quote per line through the portal. Procurement can request a price revision; the old quote is kept as a superseded record and the supplier confirms the new price. A minimum of three quotes is enforced per line, with a documented waiver (PRAZ reason categories) where fewer are available.

### 5.4 Award and purchase orders
Awards are made per RFQ line, so one RFQ can produce one purchase order per winning supplier. Two signatures are required on every award: HOD selection with written justification, and Procurement Manager authorisation. Lines without quotes are shown as unresolved and can be re-sourced in one click.

### 5.5 Approval chain
Purchase orders move in strict order: requesting-department HOD, Procurement HOD, Finance, and COO when the total is USD 5,000 or more. No stage can be skipped. Each approver has their own queue.

### 5.6 Supplier management and KYS
Suppliers are created as pending. A 19-item Know Your Supplier checklist (company registration, tax clearance, NSSA, NEC, ISO, client referrals, financials, bank references, insurance, safety and environmental policies, and more) must be verified before activation. Uploaded documents tick the matching checklist item automatically. Lifecycle actions: activate, suspend, mark dormant, reactivate, blacklist, each with a reason and audit entry. Suppliers pick from a controlled taxonomy of 24 sections and about 159 categories.

### 5.7 Supplier evaluation
Seven-criterion scoring (credit terms, contracts, reputation, pricing, delivery, ease of dealing, quality), overall score, recommendation, and a next-review date. Performance and compliance analytics rank the supplier base.

### 5.8 Stores and inventory
Multi-site inventory with bin locations, reorder levels, opening-balance imports from the legacy stock code list, stock movements history, internal store requisitions, and inter-site stock transfers with ship and receive steps. Deliveries are received against purchase orders with accept, partial and reject outcomes, and a printable Goods Received Voucher PDF.

### 5.9 Accounts payable
Suppliers submit invoices against a purchase order only. The system compares ordered, received (from stores GRVs, net of rejections) and invoiced quantities and values with a tolerance of 2% or USD 1, and explains any variance line by line. Finance approves or rejects, then records payments; invoices move from submitted to approved, partially paid and paid.

### 5.10 Budgets
Finance allocates a budget per department per financial year. The system shows committed spend from open purchase orders, utilised spend from payments, and the available balance.

### 5.11 Reporting, alerts and audit
Role-specific dashboards, spend and supplier reports with export, in-app and email notifications for every hand-off, scheduled alerts for low stock and approaching RFQ deadlines, and an audit log searchable by user, entity and action.

---

## 6. Controls the system enforces

- No supplier can quote until KYS is verified and the supplier is active.
- No purchase without an approved requisition; no requisition reaches procurement without a stores check.
- Three quotes per line or a documented, approved waiver.
- Two signatures on every award: HOD justification plus Procurement Manager authorisation.
- Ordered approval chain with a hard COO threshold at USD 5,000.
- No goods received without an approved purchase order; only Stores can receive.
- No invoice without a purchase order; no Finance approval without a stores GRV and a passing three-way match.
- Quotations are immutable once submitted; revisions create a new version.
- Records are never hard-deleted; cancellations carry coded reasons and roll downstream.
- Every action is audit-logged with user, timestamp and IP address.

---

## 7. Alignment with the Central Procurement Procedure (Rev 9)

A clause-by-clause matrix is kept in PROCEDURE_COMPLIANCE.md. Summary:

| Area | Status |
|---|---|
| Stores check before requisition | Implemented |
| Three quotations, HOD justification, waiver | Implemented |
| PM authorisation of quotation | Implemented |
| COO approval above USD 5,000; ordered approval chain | Implemented |
| KYS documents, evaluation criteria, approved supplier list, blacklisting | Implemented |
| Supplier evaluation with committee approval | Implemented |
| PO / delivery note / invoice three-way match | Implemented |
| No payment without PO | Enforced |
| Requisition and PO cancellation rules | Implemented |
| Budget blocking of over-budget requests | Not yet (budgets are tracked, not yet enforced at submission) |
| Timing SLAs (2-day sourcing, 1-hour approvals, payment days) | Not tracked |
| Emailing the PO PDF to the supplier | Partial (in-app notification only) |
| Supplier site visits, MSDS for hazardous goods, receiving attendance (MT, Security, SHEQ), 5-day return tracking | Not built |

---

## 8. Technology and hosting

| Layer | Choice |
|---|---|
| Front end | React 18, Vite, Tailwind CSS; responsive, works on phones for approvals |
| API | Node.js, Express 4, TypeScript (strict), layered routes → controllers → services → models |
| Database | MongoDB via Mongoose |
| Shared package | One typed package of roles, statuses, thresholds and categories used by both API and client so they cannot drift |
| Authentication | JSON Web Tokens plus emailed one-time codes; bcrypt password hashing; self-service password reset |
| Email | Resend |
| Documents | GRV PDF generation; compliance documents and line photos stored with size limits |
| Hosting | Vercel for both API (serverless) and client; MongoDB hosted separately |
| Scheduled jobs | Low-stock and RFQ-deadline alerts, configurable interval and de-duplication |

Currencies supported: USD (default), ZWG, ZAR.

Size of the system today:

| Measure | Value |
|---|---|
| Data models | 22 |
| API domains / endpoints | 11 / about 155 |
| Screens | 40+ |
| TypeScript source | about 50,000 lines |
| Commits on main | 124, January to August 2026 |

---

## 9. Delivery status and evidence

- **Live** at the address above; staff and supplier logins are separate.
- **Automated tests** (last run 3 July 2026): 103 of 103 role and permission checks passed; 49 of 49 end-to-end business-flow steps passed, covering supplier onboarding through payment. Client production build passes.
- **Legacy data**: the existing stock code list has been imported with bin locations; scripts exist for cleaning and importing other ERP data.
- **Documentation**: business overview, tester step-by-step guides, end-to-end handover test packs (PDF), compliance matrix, and a development handover report are in the repository.

Development history in brief: core requisition-to-PO flow and supplier portal (January to May 2026); TypeScript migration, accounts payable, KYS, approval chain, evaluations, stores gate, three-quote rule (June 2026); one-time-code login, cancellations, alerts, pagination, reporting, admin command centre (June to July 2026); price negotiation, per-line split awards with multi-PO generation and re-sourcing, two-step HOD approval, PRAZ waiver categories, equipment details and photos, GRV printing, stock code import (July 2026); GRV-gated invoice approval (August 2026).

---

## 10. What remains

Priority order recommended for the next phase:

1. **Budget enforcement at requisition submission.** Budgets are tracked; the next step is committing funds when a request is raised and blocking or flagging over-budget requests. This is the largest remaining spend control.
2. **SLA tracking.** Record and flag overdue sourcing, approvals and payments against the procedure's timelines.
3. **Emailing the official PO PDF to suppliers.**
4. **Receiving completeness.** Department representative quality sign-off, MSDS capture for hazardous goods, receiving attendance, and non-conforming return tracking.
5. **Supplier site-visit records** and a quarterly review meeting record.
6. **Integrations.** Accounting ledger export, and WhatsApp notifications for suppliers, as demand justifies.

None of these require a platform rebuild; all are additive to the existing architecture.

---

## 11. Why it matters commercially

- **Spend control.** Every dollar leaving the company passes an approved requisition, a competitive quote, a layered approval, a receipt check and a matched invoice. Leakage points (duplicate buying, unmatched invoices, single-source purchases) are closed by design.
- **Governance and audit readiness.** The procurement procedure is enforced by software, and the evidence for every decision (why this supplier, who approved, what arrived) is one click away. This supports external audit, board reporting and tender compliance.
- **Supplier base quality.** Only vetted suppliers trade; performance is scored and reviewed; poor performers are suspended or blacklisted with a recorded reason.
- **Speed.** Approvals happen from a phone, suppliers quote online, stores decisions are immediate, and status is visible without phone calls.
- **Scalability.** Multi-site, multi-currency, role-based, and built on a shared typed model. Adding a department, site or supplier is configuration, not development. The same platform can serve additional companies or group entities.
- **Ownership.** The company owns the code and its data. No per-seat licence.

---

## 12. Anticipated questions

**Is it live?** Yes. Staff and suppliers can log in today. Automated tests pass; user acceptance testing guides are in place.

**What happens if the internet is down on site?** It is a web application; a phone connection is enough for approvals. Offline capture is not built.

**Can it replace our accounting system?** No. It runs procurement through to payment recording and keeps the spend record; the general ledger stays in the accounting system. A ledger export is a natural next integration.

**How do we know suppliers cannot tamper with quotes?** Quotes are written once and locked. A price change requires procurement to request a revision, the supplier to confirm a new version, and the old version is kept.

**Who can approve a large order?** Nobody alone. An order of USD 5,000 or more needs the requesting HOD, the Procurement HOD, Finance and the COO, in that order.

**What is the biggest gap?** Budget enforcement at the point of request. Budgets are tracked and visible, but a request is not yet blocked for lack of budget. That is the recommended next build.

---

*Companion documents: SYSTEM_OVERVIEW.md (module walkthrough), PROCEDURE_COMPLIANCE.md (clause matrix), SMOKE_TEST_RESULTS.md (test evidence), DEVELOPMENT_HANDOVER.md (build history), CLIENT_TESTING_GUIDE.md (UAT).*
