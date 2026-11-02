# Tefoma Procurement — Smoke & E2E Test Results

**Product:** Tefoma Procurement  
**Last run:** 3 July 2026  
**Environment:** Localhost (`http://localhost:3001` API, MongoDB seeded via `npm run seed:all -w api`)  
**Status:** All automated checks **passed**

---

## Executive summary

| Suite | Command | Result |
|-------|---------|--------|
| **Role smoke test** | `npm run smoke -w api` | **103 / 103 PASS** |
| **Full E2E flow** | `npm run e2e:local -w api` | **49 / 49 PASS** (incl. supplier analytics) |
| **Client production build** | `npm run build -w client` | **PASS** |

These tests exercise the **API layer** (authentication, role permissions, and full procurement workflow). Browser UI clicks are **not** automated — use [CLIENT_TESTING_GUIDE.md](./CLIENT_TESTING_GUIDE.md) for manual UI walkthrough.

---

## Prerequisites (localhost)

1. MongoDB running locally.
2. Copy env files (if not already present):
   - `api/.env` from `api/.env.example` — set `MONGODB_URI`, `JWT_SECRET`, and `OTP_EXPOSE_IN_RESPONSE=true` for automated OTP login.
   - `client/.env` — `VITE_API_URL=http://localhost:3001/api`
3. Seed test data:
   ```bash
   npm run seed:all -w api
   ```
4. Start API (required before tests):
   ```bash
   npm run dev -w api
   ```

**Seeded password (all staff & supplier test accounts):** `Admin@123`

---

## How to run

```bash
# Role + endpoint smoke test (default: localhost:3001)
npm run smoke -w api

# Against production (only if accounts exist there)
node api/src/scripts/smoke-test.mjs https://fosssil-procure-api.vercel.app

# Full business-flow E2E (supplier onboarding → payment)
npm run e2e:local -w api
```

---

## Test accounts used

| Email | Role |
|-------|------|
| admin@fossilzim.com | Admin |
| macdonald@fossilzim.com | Procurement officer |
| jb@fossilzim.com | Department head (Procurement) |
| mac@fossilzim.com | Department head (ICT) |
| james@fossilzim.com | End user (ICT) |
| paul@fossilzim.com | Finance |
| tino@fossilzim.com | COO |
| alfred@fossilzim.com | Stores officer |
| ict.hw@techzone.co.zw | Supplier (TechZone Hardware) |
| ict.sw@codebridge.co.zw | Supplier (used in E2E quotes) |
| ict.maint@profix.co.zw | Supplier (used in E2E quotes) |

---

## Suite 1 — Role smoke test (103 checks)

Script: `api/src/scripts/smoke-test.mjs`

### Public / unauthenticated (6 checks) — ALL PASS

| Check | Result |
|-------|--------|
| `GET /health` | PASS |
| `GET /api/` | PASS |
| `POST /auth/login` invalid credentials → 401 | PASS |
| `POST /auth/login` missing fields → 400 | PASS |
| `GET /auth/me` without token → 401 | PASS |
| `OPTIONS /auth/login` CORS for `https://fossilprocure.vercel.app` | PASS |

### Per-role login + OTP + endpoints — ALL PASS

Each role: login → OTP verify → `GET /auth/me` → shared endpoints → role-specific GETs.

| Role | Login | Shared endpoints | Role endpoints | Total |
|------|-------|------------------|----------------|-------|
| Admin | PASS | dashboard, notifications, sites | users, departments, sites, audit-logs | 10 |
| Procurement officer | PASS | ✓ | suppliers, requisitions, rfqs, quotations, POs, evaluations/due, **evaluations**, supplier-reports | 14 |
| Dept head (Procurement) | PASS | ✓ | requisitions, pending PO approvals, store requisitions, catalog search | 10 |
| Dept head (ICT) | PASS | ✓ | requisitions, pending PO approvals, store requisitions | 9 |
| End user | PASS | ✓ | requisitions, catalog search, cancellation-meta | 9 |
| Finance | PASS | ✓ | pending approvals, POs, invoices, payments, budgets | 11 |
| COO | PASS | ✓ | pending approvals | 7 |
| Stores officer | PASS | ✓ | inventory, deliveries, pending deliveries, PR queue, movements, store reqs, transfers, sites | 14 |
| Supplier | PASS | ✓ | profile, rfqs, quotations, POs, deliveries, invoices | 12 |

### Security — PASS

| Check | Result |
|-------|--------|
| End user `GET /admin/users` → **403** | PASS |

---

## Suite 2 — Full E2E flow (49 checks)

Script: `api/src/scripts/e2e-localhost.mjs`

Covers the complete procurement lifecycle plus supplier onboarding, **supplier analytics**, and ancillary features.

### Phase 1 — Supplier onboarding (5 checks) — ALL PASS

| Step | Result |
|------|--------|
| Supplier self-registration (`POST /auth/register`) | PASS |
| New supplier views profile | PASS |
| Procurement sees pending supplier | PASS |
| Procurement activates supplier (KYS override + activate) | PASS |
| Supplier updates profile | PASS |

### Phase 2 — Requisition → payment (26 checks) — ALL PASS

| Step | Role | Result |
|------|------|--------|
| Create requisition (draft) | End user | PASS |
| Submit requisition | End user | PASS |
| Approve requisition | ICT HOD | PASS |
| Forward to procurement | Stores | PASS |
| Accept requisition | Procurement | PASS |
| Create & publish RFQ (3 invited suppliers) | Procurement | PASS |
| Submit quotation (×3 suppliers) | Suppliers | PASS |
| Close RFQ | Procurement | PASS |
| Select winning quotation + justification | ICT HOD | PASS |
| Authorize quotation | Procurement | PASS |
| Accept quotation | Procurement | PASS |
| Create purchase order | Procurement | PASS |
| Submit PO for approval | Procurement | PASS |
| Approve PO | HOD | PASS |
| Approve PO | Finance | PASS |
| Approve PO (≥ USD 5,000 threshold) | COO | PASS (PO total ~7,130) |
| Acknowledge PO | Winning supplier | PASS |
| Receive goods (GRV) | Stores | PASS |
| Delivery accepted (auto on receive) | Stores | PASS |
| Submit invoice | Supplier | PASS |
| Approve invoice | Finance | PASS |
| Record payment | Finance | PASS |

### Phase 3 — Additional scenarios (8 checks) — ALL PASS

| Step | Result |
|------|--------|
| Record supplier evaluation (7 criteria, 1–5) | PASS |
| Evaluation `overallScore` computed | PASS |
| Finance views budgets | PASS |
| Admin views audit logs | PASS |
| End user has notifications | PASS |
| End user cancels own draft requisition | PASS |
| Procurement dashboard stats | PASS |

### Phase 3b — Supplier analytics (Performance, Compliance, Evaluations) — ALL PASS

These three UI pages under **Suppliers → Analytics** share the same backend report API plus evaluation endpoints.

| UI page | Route | API(s) | What was tested | Result |
|---------|-------|--------|-----------------|--------|
| **Performance** | `/app/suppliers/analytics/performance` | `GET /procurement/supplier-reports`, `GET /procurement/evaluations/due` | Summary score bands; registry `overallScore` after evaluation; ranked suppliers | PASS |
| **Compliance** | `/app/suppliers/analytics/compliance` | `GET /procurement/supplier-reports` | Summary `kysVerified` / `kysPending`; registry `kysPercent`, `kysComplete`, `documentCount` | PASS |
| **Evaluations** | `/app/suppliers/evaluations` | `GET /procurement/evaluations/due`, `GET /procurement/evaluations`, `POST …/suppliers/:id/evaluations` | Due list; create evaluation; list history; per-supplier evaluations | PASS |

#### Metrics validated (from `getSupplierReports`)

| Metric | Used on | Source |
|--------|---------|--------|
| `overallScore` (1–5) | Performance ranking, supplier header | Latest `SupplierEvaluation.overallScore` |
| `scoreBands` (excellent / good / watch / low / unrated) | Performance summary cards | Aggregated from scores |
| `kysVerified`, `kysPending` | Compliance summary | `SupplierProfile.kysComplete` |
| `kysPercent` | Compliance table | `computeKysCompletion()` on KYS checklist |
| `documentCount` | Compliance table | `complianceDocuments.length` |
| `poCount`, `poSpend` | Reports registry (also on Reports tab) | Completed PO totals |
| `nextEvaluationDue` | Performance / Evaluations due tab | `SupplierProfile.nextEvaluationDue` |

#### Evaluation criteria (7 scores, 1–5 each)

Credit terms, contractual agreements, market reputation, pricing, delivery efficiency, ease in dealings, consistent quality — averaged into **overall score out of 5** (not a percentage).

Evaluations save **immediately** as `approved` (no HOD/SEC approval chain on new records).

#### Automated check list (Phase 3b)

| Check | Result |
|-------|--------|
| `GET /procurement/supplier-reports` returns 200 | PASS |
| Summary `totalSuppliers` > 0 | PASS |
| Summary includes KYS and score band counts | PASS |
| Registry rows include `kysPercent` | PASS |
| Evaluated supplier shows `overallScore` ≥ 3.5 | PASS |
| `GET /procurement/evaluations/due` returns due list | PASS |
| `GET /procurement/evaluations` lists E2E evaluation | PASS |
| `GET /procurement/suppliers/:id/evaluations` history | PASS |

#### Manual UI only (not automated)

- Performance / Compliance **pagination** and row click-through to supplier profile
- Evaluations **Create evaluation** modal (sliders, recommendation dropdown)
- Compliance **filter by status** on Suppliers list
- KYS document upload impact on `kysPercent` (E2E uses KYS override for onboarding instead)

---

## What is NOT covered by automation

The following still require **manual UI testing** in the browser (`npm run dev -w client` → http://localhost:5173):

- All 57 client routes (forms, tabs, modals, validation messages)
- KYS document **file uploads** (API override used in E2E instead)
- Store requisition / stock transfer UI flows (separate from main PR→PO path)
- Quotation waiver UI (E2E uses 3 real quotes instead)
- Email delivery (OTP appears in API console when `OTP_EXPOSE_IN_RESPONSE=true`)
- Production environment (production DB may not have all seeded accounts)

See [CLIENT_TESTING_GUIDE.md](./CLIENT_TESTING_GUIDE.md) and [TESTING_GUIDE.md](./TESTING_GUIDE.md) for manual test steps.

---

## Production note

A smoke run against **https://fosssil-procure-api.vercel.app** on the same date showed:

- Public endpoints and **admin** login: **PASS**
- Other seeded accounts: **FAIL** (401 — accounts not present or different passwords in production DB)

Run production smoke only after seeding or creating matching users in the live database.

---

## Related documents

| Document | Purpose |
|----------|---------|
| [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) | What the system does (business view) |
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Step-by-step manual E2E for testers |
| [CLIENT_TESTING_GUIDE.md](./CLIENT_TESTING_GUIDE.md) | Live-site UAT guide |
| [PROCEDURE_COMPLIANCE.md](./PROCEDURE_COMPLIANCE.md) | Policy vs implementation matrix |

---

*Re-run tests after major changes and update the “Last run” date and summary tables above.*
