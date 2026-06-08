# fossilProcure — Development Report

**Developer:** sairosthedev (`macdonaldsairos@gmail.com`)
**Prepared for:** Collins (management review)
**Date:** 4 June 2026
**Procedure reference:** Central Procurement Procedure Rev 9.0 (FC-HQ-P-07)
**System:** MERN monorepo — `api/` (Express + MongoDB), `client/` (React), `packages/shared/` (shared constants)

---

## How to read this report

This report has three parts:

- **Part 1 — Work delivered:** everything I built, and *what each piece actually does*.
- **Part 2 — Delivery status:** what is committed to Git vs. what is built but not yet committed.
- **Part 3 — My recommendations:** gaps I found in the system and what I propose we build next.

---

# PART 1 — WORK DELIVERED (what it does)

## 1. Migrated the whole codebase to TypeScript

**What I did:** Converted the entire JavaScript project (~260 files across API, client, and shared package) to **strict TypeScript** with modern ESM modules, added `tsconfig.json` for each workspace, and wrote conversion scripts to automate the bulk rename and fix-ups.

**What it does for us:**
- The compiler now catches type mistakes (wrong fields, missing values, bad function calls) **before** code runs, instead of failing in production.
- Editors give autocomplete and inline error checking, so future development is faster and safer.
- Shared business constants (roles, currencies, regions, statuses, procurement thresholds) live in one typed package used by both the API and the website, so the two can’t drift apart.

**Build reliability:** I fixed the Vercel deployment so the shared package compiles first, and I stopped the browser dev server from serving a stale cached copy of shared code (which had been causing "missing export" crashes). Both API and client now pass a clean typecheck and build.

---

## 2. Accounts Payable — invoices, 3-way match, payments (Procedure §6.6.1, §6.3.15)

**What I did:** Built a complete supplier-billing module.

**What it does, step by step:**
1. A supplier submits an **invoice against a specific Purchase Order** (they cannot invoice for something with no PO — this enforces §6.8.1 "no payment without a PO").
2. The system runs a **three-way match** comparing three things:
   - what was **ordered** (PO quantities and prices),
   - what was **received** (goods receipted at stores), and
   - what is being **invoiced**.
3. It checks each line and the totals against a **tolerance of 2% or $1** (whichever is larger). If the invoice quantity exceeds what was received, or amounts don’t line up, it flags the invoice as a **variance** with a plain-English explanation per line (e.g. *"invoiced qty (10) exceeds received (6)"*).
4. Finance reviews matched invoices and **approves or rejects** them.
5. Once approved, Finance can **record payments**; the invoice tracks **amount paid and balance due**, moving through `submitted → approved → partially_paid → paid`.

**Why it matters:** This closes the loop from ordering to paying, and prevents overpaying or paying for goods we never received.

---

## 3. Know Your Supplier (KYS) onboarding & documents (Procedure §6.2.3)

**What I did:** Turned supplier onboarding into a controlled, document-backed process.

**What it does:**
- Encoded the **full §6.2.3 checklist (19 items, a–s)** — CR14, CR6, tax clearance, NSSA, NEC, ISO, company profile, 3 client referrals, audited financials, bank references, warranties, after-sales support, safety, environmental policy, insurance, disaster preparedness, etc. — each tagged as **mandatory or optional** with its procedure clause.
- **New suppliers now start as `pending`, not active.** A supplier can only become **`active`** once their KYS is verified. (Previously suppliers were created active with no vetting — this was a compliance hole I closed.)
- Suppliers can **upload their own KYS documents**, and procurement can **upload on their behalf**. Each uploaded document **automatically ticks** the checklist item it satisfies and recomputes whether KYS is complete.
- Documents are stored safely (max 5 MB each), the latest upload of a type replaces the old one, and **verified documents cannot be deleted**.
- Procurement has a **verify** action that finalises KYS and activates the supplier.

**Why it matters:** We no longer trade with unvetted suppliers, and the evidence (certificates, references) is attached to each supplier on file.

---

## 4. Supplier category system (taxonomy)

**What I did:** Created a single **canonical list of supplier categories (24 sections, ~159 categories)** shared across the whole system, replacing the old free-text "categories" box.

**What it does:**
- Suppliers, inventory items, and requisition lines all pick from the **same controlled list** (stored as codes, shown as names), so spelling/variants no longer fragment the data.
- When creating an **RFQ**, the system reads the categories on the requisition and **auto-suggests and pre-selects the suppliers who actually serve those categories** (with a "Suggested" badge). This makes sure we invite the *right* approved suppliers to quote.
- Categories are **validated** on supplier create and bulk import, so bad data can’t get in.

**Why it matters:** Accurate supplier matching and cleaner reporting; sourcing the right vendors becomes automatic instead of manual guesswork.

---

## 5. New "End User" role and corrected requisition flow

**What I did:** Added a dedicated **End User** role and fixed the approval sequence.

**What it does:**
- Previously the Department Head was effectively raising and approving their own requests. Now an **End User raises the requisition**, and it flows:
  **End User submits → Department Head approves/rejects → Stores review → Procurement.**
- End Users only see **their own** requisitions; Department Heads/admins see the **whole department’s**.
- Added the HOD **reject** action and the proper notifications at each hand-off.

**Why it matters:** Proper separation of duties — the person requesting is not the person approving.

---

## 6. Sequential Purchase Order approval chain (Procedure §6.3.11–6.3.12)

**What I did:** Implemented the required ordered sign-off for purchase orders.

**What it does:**
- A PO moves through approvals **in order: Procurement → Department Head → Finance → COO**, with each stage having its own pending queue.
- **COO approval is only required when the value is ≥ USD 5,000** (the procedure threshold). Below that, it completes after Finance.
- The system computes the next required approver automatically and won’t let a stage be skipped.

**Why it matters:** Spending authority is enforced exactly as the procedure dictates, with COO oversight on large orders.

---

## 7. Supplier evaluation & SEC approval (Procedure §6.2.4–6.2.6)

**What I did:** Built a formal supplier evaluation record.

**What it does:**
- Captures **scored evaluations** (credit, pricing, quality, delivery, etc.), computes an **overall score**, and records a **recommendation** (approve / reject / conditional / re-evaluate later).
- Routes the evaluation through **HOD review → Procurement Manager → Supplier Evaluation Committee (SEC) approval**.
- Supports **initial, re-evaluation, and quarterly review** types, and tracks when the next review is due.

**Why it matters:** Supplier approval and ongoing performance review become evidence-based and committee-approved, as required.

---

## 8. Stores gate + three-quote rule with waiver (Procedure §6.3.1–6.3.6)

**What I did:** Enforced the "check stores first" and "get three quotes" rules.

**What it does:**
- **Stores gate:** approved requisitions land in a **stores queue**. Stores either **fulfil from existing stock** or **forward to procurement** for buying — so we don’t buy what we already have.
- **Three-quote rule:** before a quotation can be accepted, the system checks there are **at least 3 quotations**. If fewer, it requires a **documented waiver** (reason + approver).
- **HOD selects** the winning quotation **with a written justification**, and the **Procurement Manager authorises** it. A quotation is only "fully authorised" when both the HOD selection (with justification) and PM authorisation point to the same quote.

**Why it matters:** Competitive sourcing and a clear audit trail for *why* a particular supplier was chosen.

---

## 9. Supplier detail view & lifecycle actions (most recent work)

**What I did:** Added a **View** button on the supplier list that opens a full detail panel with all supplier actions.

**What it does:**
- Shows company details, registration/tax numbers, contact, address, banking, categories, and a **KYS summary** (verified state, checklist progress, document count).
- Provides status-aware actions: **Approve & activate, Suspend (reason required), Mark dormant, Reactivate, Blacklist (reason required), and Manage KYS**.
- Guards built in: you **can’t reactivate a supplier until KYS is complete**, blacklisted suppliers are locked, and every change is **audit-logged and notifies the supplier**.

**Why it matters:** One place for procurement to manage a supplier’s whole lifecycle, consistently and with an audit trail.

---

# PART 2 — DELIVERY STATUS (committed vs. not)

> Honest status so management knows what is already on GitHub vs. on my machine.

### Committed to Git (visible on GitHub under author **sairosthedev**)

5 commits, all 4 June 2026 — **the TypeScript migration and build fixes only**:

| Commit | Summary |
|--------|---------|
| `31c0c62` | Migrate monorepo to TypeScript (ESM + strict) |
| `46b3905` | Strict TS fixes — API (procurement, supplier, stores) |
| `44d0418` | Strict TS fixes — client (typecheck + build pass) |
| `a0141ff` | Fix API TS build errors for Vercel |
| `cd40f6e` | Build shared package before api/client on Vercel |

### Built but NOT yet committed (local working copy)

Everything in **Part 1, sections 2–9** — Accounts Payable, KYS, categories, End User role, PO approval chain, supplier evaluation, stores gate, three-quote rule, and the supplier detail view.

- **54 existing files modified** (≈ +1,300 / −270 lines)
- **52 new files added** (models, services, controllers, pages, shared constants, and the two report documents)
- **Not yet pushed to the remote**, so GitHub does not show these features yet.

**Recommendation:** commit and push this work in logical groups so the repository reflects what has actually been delivered. (I can do this on request.)

---

# PART 3 — MY RECOMMENDATIONS (gaps + what I propose)

These are gaps I identified against Rev 9 while building, and improvements I suggest. The full clause-by-clause matrix is in `PROCEDURE_COMPLIANCE.md`.

### High priority

1. **Budget commitment on requisition.** When a requisition is submitted/approved, reserve the money against a department budget so we can’t over-commit spend. *(Biggest control gap right now.)*
2. **Commit & push the Part 2 work** so the codebase, deployment, and history match what’s been built.
3. **PO / requisition cancellation workflows (§6.4–6.5).** We have a "cancelled" status but no proper cancellation process (who can cancel, reasons, downstream effects).

### Medium priority

4. **RFQ detail screen for HOD/PM.** The backend for HOD selection, PM authorisation, and waiver exists, but the on-screen experience for these steps should be finished so users aren’t doing it through workarounds.
5. **SLA / deadline tracking (§6.1).** The procedure sets timeframes (sourcing in 2 days, approvals per role, payment days). I suggest tracking these and flagging overdue items.
6. **Email the PO PDF to suppliers (§6.3.14).** Currently we notify in-app; suppliers should also receive the official PO document by email.

### Lower priority / compliance completeness

7. **Supplier site-visit / field-vetting records (§5.5).**
8. **MSDS handling for hazardous materials at receiving (§6.6.3).**
9. **Receiving attendance sign-off — MT, Security, SHEQ (§6.8.5).**
10. **Non-conforming goods return tracking (5-day rule)** and department-rep quality sign-off on deliveries (§6.6.2, §6.6.7–6.6.9).
11. **Quarterly supplier review meetings (§5.7)** — we track the due date; a meeting/minutes record would complete it.

---

## Appendix — how to verify and run

```bash
# See my committed commits
git log --author="sairosthedev" --oneline

# See the uncommitted feature work
git status
git diff --stat HEAD

# Build & typecheck
npm install
npm run build
cd api && npx tsc --noEmit -p tsconfig.json
cd client && npx tsc --noEmit -p tsconfig.json

# Run locally
npm run dev
```

*Companion document: `PROCEDURE_COMPLIANCE.md` (clause-by-clause Rev 9 status).*
