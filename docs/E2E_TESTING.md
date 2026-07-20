# Tefoma Procurement — End-to-End Testing Guide

A step-by-step procedure for running a full E2E test pass of Tefoma Procurement, from a clean environment to a signed-off report. Follow the sections in order.

- **Automated pass** (~5 min): API-level scripts that exercise the whole flow.
- **Manual pass** (~45–90 min): browser walkthrough of every role, verifying the UI.

Do the automated pass first — if it fails, fix the environment before spending time on manual testing.

---

## 1. Prerequisites

| Requirement | Check |
|---|---|
| Node.js ≥ 18 | `node -v` |
| MongoDB running locally (or a reachable Atlas URI) | `mongosh --eval "db.runCommand({ping:1})"` |
| Repo dependencies installed | `npm install` from the repo root |

## 2. Environment setup

### 2.1 API — `api/.env`

Copy `api/.env.example` → `api/.env` and set at minimum:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/fossil-procure
JWT_SECRET=<any long random string>
CLIENT_URL=http://localhost:5173
```

> **OTP note:** every login requires a one-time code. For testing, leave `OTP_EXPOSE_IN_RESPONSE` unset (it defaults to **true**), which puts the OTP in the login API response — the automated scripts depend on this, and in the browser you can read it from DevTools → Network → `login` response, or from the API console. Email delivery (`RESEND_API_KEY`, `EMAIL_FROM`) is optional; in-app notifications work without it.

### 2.2 Client — `client/.env`

Copy `client/.env.example` → `client/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

### 2.3 Reset and seed the database

Run from the repo root. **Warning: `db:wipe` deletes all data in the target database** — only run it against a test database.

```bash
npm run db:wipe -w api     # optional: start from a clean slate
npm run seed:all           # all staff roles + 6 active suppliers
```

### 2.4 Start the stack

```bash
npm run dev                # starts API on :3001 and client on :5173
```

Verify: `http://localhost:3001/health` returns OK and `http://localhost:5173` loads the login page.

## 3. Test accounts

All seeded accounts use password **`Admin@123`**.

| Email | Role | Used in step(s) |
|---|---|---|
| james@fossilzim.com | End user (ICT) | 5.1 |
| mac@fossilzim.com | Department head (ICT) | 5.2 |
| alfred@fossilzim.com | Stores officer | 5.3, 5.9 |
| macdonald@fossilzim.com | Procurement officer | 5.4, 5.6, 5.7 |
| ict.hw@techzone.co.zw (or any `ict.*@techzone.co.zw`) | Supplier | 5.5, 5.8, 5.10 |
| jb@fossilzim.com | Department head (Procurement) — PO HOD approval | 5.7 |
| paul@fossilzim.com | Finance | 5.7, 5.10 |
| tino@fossilzim.com | COO (PO ≥ $5,000) | 5.7 |
| admin@fossilzim.com | Admin — users, sites, audit logs | 5.11 |

Login pages: staff → `/login` · supplier → `/supplier/login` · supplier self-registration → `/register`.

---

## 4. Automated pass

### 4.1 Full localhost E2E

Covers supplier self-registration and onboarding, then requisition → RFQ → quote → PO approvals → delivery → invoice → payment, plus extra role scenarios and supplier analytics — all via the API.

```bash
npm run e2e:local -w api
```

- Requires the API running on `:3001` and a seeded database (section 2).
- Prints `✓` / `✗` per step and a pass/fail summary. **Exit criteria: 0 failures.**
- Common failure: `OTP_EXPOSE_IN_RESPONSE must be true` → remove `OTP_EXPOSE_IN_RESPONSE=false` from `api/.env` and restart the API.

### 4.2 Role/endpoint smoke test

Logs in as every role and hits each role's key endpoints. Use it to quickly validate a deployment (local or production).

```bash
npm run smoke -w api                                        # local (:3001)
node api/src/scripts/smoke-test.mjs https://<api-host>      # any deployed API
```

Past results and artifacts live in `REPORTS/` (JSON per flow + run manifest + PDF report).

---

## 5. Manual browser pass

Run one requisition through the entire lifecycle. Keep a copy of section 6's checklist open and tick each step as you verify it. Log out and log in as the next role at each step (or use separate browser profiles/incognito windows per role).

**Pre-step (stores officer, `alfred@fossilzim.com`):** open **Inventory** and add a few catalog items with quantities on hand — the requisition in 5.1 should reference some items that are in stock and some that are not, so both the fulfil-from-stock and forward-to-procurement paths get exercised. Optional: Admin → **Sites** → add a second site if you want to test stock transfers.

### 5.1 End user creates a requisition
Login `james@fossilzim.com` → Requisitions → Create Requisition → search the stock catalog (plus one manually-typed line), set category and quantity per line → submit.
**Expect:** requisition saved with *pending* status; department head is notified.

### 5.2 Department head approves
Login `mac@fossilzim.com` → Approvals (or Requisitions) → approve (also test **reject with reason** on a throwaway requisition).
**Expect:** status updates; requester receives a notification.

### 5.3 Stores review
Login `alfred@fossilzim.com` → **Stores PR Review** → issue in-stock lines (per line via **Search inventory**, or **Auto-process stock**) → **Forward to procurement** for the rest.
**Expect:** inventory quantities decrease for issued lines; requisition moves to fulfilled and/or the procurement queue.

### 5.4 Procurement creates the RFQ
Login `macdonald@fossilzim.com` → RFQs → create from the forwarded requisition → invite active suppliers → publish.
**Expect:** invited suppliers see it under **My RFQs** and receive a notification that links to the RFQ detail page.

### 5.5 Supplier submits a quotation
Login `ict.hw@techzone.co.zw` → My RFQs → open the RFQ → Submit Quote.
**Expect:** quote appears under My Submitted Quotations; procurement is notified.

### 5.6 Procurement selects the winner
Login `macdonald@fossilzim.com` → Quotations → review and select the winner. If fewer than 3 quotes were received, complete the **3-quote waiver** flow.
**Expect:** selection recorded; PO can be raised from the winning quote.

### 5.7 Purchase order approval chain
1. Procurement submits the PO.
2. HOD (`jb@fossilzim.com`) approves in **Approvals**.
3. Finance (`paul@fossilzim.com`) approves in **Approvals**.
4. If PO total ≥ **USD 5,000**: COO (`tino@fossilzim.com`) must also approve. Test both a sub-$5,000 PO (no COO step) and a ≥ $5,000 PO (COO required) if time allows.

**Expect:** PO reaches *approved* only after the full chain; each approver sees it in their queue in order.

### 5.8 Supplier acknowledges the PO
Supplier → My Purchase Orders → acknowledge (attach delivery note if prompted).
**Expect:** PO status shows acknowledged.

### 5.9 Goods receipt
Login `alfred@fossilzim.com` → **Deliveries** → **Receive** against the PO (GRV) → open the delivery → **Accept into stock** (test accept; optionally partial or reject on another line).
**Expect:** delivery status updates; inventory increases on acceptance.

### 5.10 Invoice and payment
1. Supplier submits an invoice against the PO.
2. Finance (`paul@fossilzim.com`) → Invoices → approve.
3. Open invoice detail → record payment.

**Expect:** invoice moves approved → paid; supplier is notified.

### 5.11 Notifications and audit trail
- Each role: check the **Notifications** panel reflects the actions above.
- Admin (`admin@fossilzim.com`) → **Audit Logs**: verify the full trail for this requisition/PO exists.

---

## 6. Pass/fail checklist

| # | Step | Pass | Notes |
|---|---|---|---|
| 0 | Automated `e2e:local` — 0 failures | ☐ | |
| 1 | Requisition created (catalog + manual line) | ☐ | |
| 2 | HOD approve + reject-with-reason | ☐ | |
| 3 | Stores issue stock / forward to procurement | ☐ | |
| 4 | RFQ published; suppliers notified | ☐ | |
| 5 | Supplier quote submitted | ☐ | |
| 6 | Winner selected (waiver if < 3 quotes) | ☐ | |
| 7 | PO chain: HOD → Finance (→ COO ≥ $5k) | ☐ | |
| 8 | Supplier PO acknowledgement | ☐ | |
| 9 | GRV received + accepted into stock | ☐ | |
| 10 | Invoice approved + payment recorded | ☐ | |
| 11 | Notifications + audit log complete | ☐ | |

## 7. Reporting results

For every failure, record:

1. Role/account used and the exact step number above.
2. What you expected vs. what happened (error message or screenshot).
3. Whether it was a failed action, missing permission, or confusing wording.

Save run artifacts (JSON output, screenshots, summary) in `REPORTS/` — see `REPORTS/smoke-run-manifest.json` for the format used by previous runs.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Automated script: "API not reachable" | Start the API: `npm run dev -w api` |
| Automated script: "OTP_EXPOSE_IN_RESPONSE must be true" | Remove `OTP_EXPOSE_IN_RESPONSE=false` from `api/.env`, restart API |
| Login OTP never arrives | Email not configured — read OTP from the API console or the login response in DevTools → Network |
| Supplier can't see the RFQ | Supplier must be **active** and invited to that RFQ; re-check invite list |
| COO approval step missing | Only required when PO total ≥ USD 5,000 |
| Stale/odd data mid-run | Reset: `npm run db:wipe -w api` then `npm run seed:all` |

## 9. Related documents

- `TESTING_GUIDE.md` — non-technical tester walkthrough (superset of section 5 with more UI detail).
- `SMOKE_TEST_RESULTS.md` and `REPORTS/` — previous run results and artifacts.
- `PROCEDURE_COMPLIANCE.md` — mapping of flows to Procurement Procedure Rev 9.
