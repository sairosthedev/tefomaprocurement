# FosssilProcure — System Improvement Proposal

**Prepared for:** Collins Jimu
**Prepared by:** Macdonald Sairos
**Date:** 4 June 2026
**Status:** For Approval

---

## 1. Executive Summary

FossilProcure already digitises the core procurement lifecycle — from purchase requisition, through RFQ and supplier quotations, to purchase orders, multi-level approvals, goods receipt and inventory updates. The foundation is solid and working.

This proposal requests approval to deliver a focused set of improvements that:

- **Complete the financial cycle** by adding invoicing and payments (currently the process stops at goods receipt).
- **Introduce real budget controls** so spend is committed and tracked against department budgets.
- **Strengthen governance** around supplier onboarding, approvals and access security.
- **Improve day-to-day reliability** by closing a small number of known gaps.

The work is grouped into five phases over an estimated **6–8 weeks**, and can be approved in full or phase-by-phase. The highest-value item — Accounts Payable — is recommended first.

---

## 2. Where We Are Today

| Capability | Status |
|---|---|
| User & role management (7 roles) | Live |
| Supplier onboarding (approve / suspend / blacklist) | Live |
| Purchase requisitions | Live |
| RFQ to suppliers & digital quotations | Live |
| Quotation evaluation & purchase orders | Live |
| Finance + COO approval of purchase orders | Live |
| Goods receipt & automatic inventory updates | Live |
| Internal store requisitions & stock issue | Live |
| Notifications (in-app + email) & audit logging | Live |
| **Invoicing & supplier payments** | **Not built** |
| **Budget tracking & control** | **Placeholder only (sample figures)** |
| **Password reset / secure first login** | **Not built** |
| **Automatic 3-way invoice matching** | **Not built** |

**In short:** the procurement workflow is in place; the financial close-out, budget discipline and a few governance features are not yet there.

---

## 3. What We Want to Improve

### Priority 1 — Accounts Payable (Invoice & Payment)
**The single biggest gap.** Today the system tracks goods up to receipt, but invoices and payments are still handled outside the system.

**What we will add:**
- Suppliers/Finance capture invoices against a purchase order.
- **Automatic 3-way match** (purchase order vs goods received vs invoice) that flags any price or quantity differences before payment.
- Finance approval and payment recording, with full status tracking through to "Paid".

**Business value:** prevents overpayment and duplicate payments, enforces that we only pay for what was ordered and received, and gives a complete, auditable spend record in one place.

---

### Priority 2 — Real Budget Control
Today the Budgets screen shows sample numbers only.

**What we will add:**
- Department budgets per financial year.
- Funds **committed** when a requisition/order is raised and **spent** when paid, with automatic **release** if cancelled or rejected.
- Live "available budget" visibility and optional blocking of over-budget requests.

**Business value:** real-time budget discipline, no surprise overspend, better planning and reporting.

---

### Priority 3 — Demand & Sourcing Improvements
**What we will add:**
- A formal **stores review** step: stock that is already on hand is issued directly instead of being purchased again.
- Ability to raise a purchase order **directly from a requisition** for contract or single-source purchases (without a full RFQ).

**Business value:** avoids buying items we already hold, speeds up routine and contracted purchases.

---

### Priority 4 — Supplier Onboarding & Security Hardening
**What we will add:**
- **Email invitations** for new suppliers instead of manually sharing passwords.
- **Forced password change on first login** and self-service **password reset**.
- **Automatic supplier matching by category** when an RFQ is issued (suggests relevant suppliers).

**Business value:** stronger security and compliance, faster and more professional supplier onboarding.

---

### Priority 5 — Reliability Fixes (Quick Wins)
**What we will add:**
- RFQs automatically progress and close at their deadline (no manual chasing).
- Removal of unused/legacy logic and minor workflow tidy-ups.

**Business value:** smoother daily operation and fewer manual steps.

---

## 4. Proposed Delivery Plan

| Phase | Scope | Indicative Effort | Outcome |
|---|---|---|---|
| **0** | Reliability quick wins | 1–2 days | Cleaner, more automated workflow |
| **1** | Accounts Payable (invoice, 3-way match, payment) | 1.5–2 weeks | Complete financial cycle |
| **2** | Real budget control | ~1 week | Live budget tracking & control |
| **3** | Demand & sourcing improvements | ~1 week | Less waste, faster contract buys |
| **4** | Supplier onboarding & security | ~1 week | Stronger governance & security |

**Total indicative timeline:** 6–8 weeks. Phases can be released independently as each is completed.

> Note: timelines are development estimates and exclude user acceptance testing and any third-party setup (e.g. email service configuration), which are minor.

---

## 5. Benefits Summary

| Benefit | Driven by |
|---|---|
| End-to-end spend visibility (request → pay) | Priority 1 |
| Prevention of over/duplicate payments | Priority 1 (3-way match) |
| Real-time budget control & accountability | Priority 2 |
| Reduced wasteful re-purchasing | Priority 3 |
| Faster supplier onboarding, stronger security | Priority 4 |
| Lower manual effort, fewer errors | Priority 5 |

---

## 6. Risk & Cost Considerations

- **Low technical risk:** all changes build on the existing, proven architecture — no platform rebuild.
- **No new licensing required** for the core work. Email invitations use the email service already integrated.
- **Phased approach** means value is delivered incrementally and budget can be approved per phase.
- Existing data and live workflows are unaffected; new modules are additive.

---

## 7. Approval Requested

Please indicate approval for the work to proceed:

| Option | Approve (✓) |
|---|---|
| Approve **all phases** (recommended) | ☐ |
| Approve **Priority 1 (Accounts Payable) only** for now | ☐ |
| Approve **specific phases:** _________________________ | ☐ |
| Request changes / discuss | ☐ |

**Approved by:** ______________________________

**Signature:** _________________________  **Date:** ______________

---

*Prepared regarding the FosssilProcure Integrated Procurement & Stores Management System for Fossil Contracting.*
