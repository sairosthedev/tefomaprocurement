# Sourceline — Multi-Entity Plan for 15 SBUs

**Status:** Draft for review. Phase 0 (rebrand) is implemented on `feat/sourceline-multi-entity`; nothing else has changed yet.
**Platform name:** Sourceline (Sourceline Procurement System). Brand colours from the logo: navy `#051A38`, royal blue `#005CE6`.

## 1. Goal

Turn the single-company procurement system (built for Fossil Contracting) into one group platform serving all fifteen SBUs, where:

- each SBU runs its own procurement in **its own database, on its own domain** — its own users' access, sites, approvals, budgets, stock and documents;
- the group sees across SBUs on purpose — shared supplier master, common item catalogue, framework contracts, intra-group trade, price variance;
- every procurement figure the group command centre shows is an aggregate of real transactions in this system, keyed by the same SBU codes the command centre uses (`DOKUMA`, `FOSSIL`, `KHAYA_CEMENT`, …).

## 2. Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Existing data belongs to **FOSSIL** | Confirmed |
| D2 | Stay on **MongoDB**; feed the command centre (Postgres) via an API / scheduled export keyed by SBU code | Assumed |
| D3 | **Multi-database:** one database per SBU, plus one **platform** database for group-wide data | Confirmed |
| D4 | **Multi-domain:** every SBU has its own domain; the SBU is identified from the domain the request comes from | Confirmed |
| D5 | **One group supplier master** in the platform database; KYS and bank-change control done once; each SBU holds its own relationship (approved / suspended, rating) in its own database | Assumed |
| D6 | **One group item catalogue** in the platform database; SBU-local stock codes, reorder levels and stock balances in the SBU database | Assumed |
| D7 | **User identity** (email, password, OTP) in the platform database with a membership per SBU, so one person can work in several SBUs with one set of credentials | Assumed |
| D8 | Pilot: **all twelve Zimbabwean SBUs** — DOKUMA, FOSSIL, KHAYA_CEMENT, KURIMA_CENTRE, MANDFAR, MASIMBA, PERSIMMON, PROPLASTICS, RHOPOWER, GRAIN_HUB, TITAN, TRENDS. South African SBUs (ENVIRO_PLASTIC, MANGETHE, THANDO_KINETICS) follow | Confirmed |
| D9 | Existing **suppliers, stock and users stay with FOSSIL**; all existing **transactions are deleted** during migration | Confirmed |
| D10 | **Thando Kinetics** is treated like every other SBU for now; acting as the group buying and trucking desk is a later phase | Confirmed |

## 3. Organisation model

```text
Group
 └── SBU            (15 — codes match command-centre fixtures; one database + one domain each)
      └── Division  (optional — Masimba 5 divisions, Mandfar 4 lines, Fossil 5 work types,
      │              Persimmon development/letting, Enviro processing vs own-account,
      │              Mangethe consulting vs contracting)
      └── Site / Department   (existing models, inside the SBU database)
```

Purchases are coded to division where the SBU has divisions, because several scorecards split cost by line of business.

## 4. Databases

All databases sit on the existing Atlas cluster, named per environment, exactly as today's `fossil-procure-prod` / `-staging` / `-dev` are.

```text
sourceline-prod-platform        group-wide data
sourceline-prod-dokuma          ┐
fossil-procure-prod  (FOSSIL)   │ one per SBU — Fossil keeps its existing database
sourceline-prod-khaya_cement    │
…                               ┘
```

The database name for each SBU is stored in the SBU registry, so Fossil keeps its current database rather than being copied. An SBU can also be given a **dedicated cluster** (connection string held as a secret, referenced from the registry) — useful for the listed companies, Masimba and ProPlastics, if their auditors require it.

### What lives where

| Platform database | Each SBU database |
|---|---|
| `Sbu` registry — code, name, country, base currency, status, domains, database name, branding (logo, legal name, address, VAT no.) | Department, DepartmentBudget, Site, `Division` |
| User — identity, password, `memberships: [{ sbu, role, department, sites }]`, group roles | Inventory, `SbuItem` (local code, reorder level, preferred supplier), StoreRequisition, StoreTransaction, StockTransfer |
| SupplierProfile, SupplierBankChangeRequest (group supplier master) | `SbuSupplier` (this SBU's status, categories, payment terms), SupplierEvaluation |
| Item (group catalogue) | PurchaseRequisition, RFQ, Quotation, QuotationEvaluation, PurchaseOrder, Delivery, Invoice, Payment |
| OtpChallenge, `FxRate`, `FrameworkContract`, group KPI roll-ups | `ApprovalPolicy`, `Counter`, Notification, AuditLog |
| Platform AuditLog (group actions, cross-SBU reads) | |

Because each SBU's transactions are in their own database, **today's unique indexes (PO number, site code, department name…) are already per-SBU** and need no change.

## 5. How the code finds the right database

181 files import models directly (`import { PurchaseOrder } from '../models/index.js'`). Rather than change every controller, the model exports become **resolvers**:

1. **Request context** — `AsyncLocalStorage` holds `{ sbu, user }` for the request.
2. **Tenant connections** — `connectionFor(sbu)` returns `platformConnection.useDb(sbu.dbName, { useCache: true })`, which shares the cluster's connection pool (cheap on Vercel), or a cached dedicated connection when the SBU has its own cluster.
3. **Model resolvers** — `models/index.ts` exports a proxy per SBU model; `PurchaseOrder.find(...)` and `new PurchaseOrder(...)` resolve to the model on the current request's SBU connection. Platform models (User, SupplierProfile, Item, …) are bound to the platform connection directly.
4. **Fail closed** — using an SBU model with no SBU in context throws. There is no "all SBUs" query; group views go through an explicit fan-out helper (section 9).
5. **Cross-database references** — SBU documents reference users (70 refs), suppliers (10) and items (5) in the platform database. Those refs point at the platform model object instead of a name, so `populate()` reads across databases correctly.
6. **Background jobs** (`api/src/jobs/`) loop over the registry and run each SBU's pass inside that SBU's context.

An automated test boots two SBU databases and asserts that every endpoint called on one domain never returns the other's data.

## 6. Domains

| Domain | Who | What |
|---|---|---|
| `fossil.<base-domain>`, `khaya.<base-domain>`, … | SBU staff | That SBU's procurement — one per SBU |
| Optional custom domain per SBU, e.g. `procure.khayacement.co.zw` | SBU staff | Same as above, on the SBU's own brand |
| `group.<base-domain>` | Group roles | Supplier master, catalogue, framework contracts, cross-SBU reports, SBU administration |
| `suppliers.<base-domain>` | Suppliers | One portal showing RFQs and POs from every SBU the supplier is approved for |

`<base-domain>` is to be confirmed (e.g. `sourceline.co.zw`).

**Deployment:** one client build and one API, as today. All domains are attached to the same Vercel client project (a wildcard `*.<base-domain>` covers SBU subdomains; custom domains are added individually and verified by the SBU's DNS admin).

**Resolving the SBU:**

- The client reads its hostname and loads that SBU's public branding (name, logo) before login, so each domain's login page shows the business it belongs to.
- The API resolves the SBU from the request's `Origin`, matched against the registry. CORS allowed origins are built from the registry instead of env vars.
- The JWT carries the SBU it was issued for. `protect` rejects a token presented on a different SBU's domain, so a Fossil session can't be replayed against Khaya.
- Logging in on an SBU domain only succeeds for users with a membership in that SBU. One person with several memberships uses the same credentials on each domain.
- Email links (approvals, RFQs, password reset) point at the SBU's own domain; supplier emails point at the supplier portal.
- Non-browser callers (the command centre) use API keys scoped to an SBU or to the group.

## 7. Roles

| Scope | Roles |
|---|---|
| SBU (per membership) | existing roles: end_user, department_head, procurement_officer, finance, coo (relabelled per SBU, e.g. MD/CEO), stores_officer, admin |
| Group (group domain) | group_admin (creates SBUs, manages platform), group_procurement (supplier master, catalogue, framework contracts), chairman_office (read-only across all SBUs), group_auditor (read-only + audit log) |
| External (supplier portal) | supplier — in the group supplier master, sees RFQs from any SBU it is approved for |

`req.user.role` is resolved from the membership for the current SBU, so the existing `authorize(...)` checks keep working unchanged.

## 8. Money, currency and numbering

**Currency.** Today PurchaseOrder, Invoice and Payment have **no currency field** — only Quotation has one (`USD | ZWG | ZAR`) — and the COO rule (`COO_APPROVAL_THRESHOLD_USD = 5000`) applies the USD figure to non-USD amounts as-is. Every money document will store `currency`, `fxRateToUsd`, `fxRateSource`, `fxRateDate`; thresholds move into each SBU's `ApprovalPolicy` in its base currency; `SZL` is added for Mangethe.

**Numbering.** Numbers are generated as `count + 1` from `countDocuments()` in `pre('save')`, which can issue duplicates under concurrent saves. This is replaced with an atomic `Counter` per SBU database (`findOneAndUpdate` + `$inc`, keyed by document type and year). Numbers carry the SBU prefix — e.g. `KHC-PO-2026-00001` — because suppliers receive documents from many SBUs.

## 9. Group views across databases

Cross-SBU features read many databases, through one helper that fans out over the registry with bounded concurrency:

- **Live views** on the group domain (open POs, approvals pending, supplier exposure) fan out at request time.
- **Analytics** (price variance, spend through framework contracts, savings vs baseline, intra-group capture) come from a nightly roll-up job that writes KPI tables into the platform database. The command-centre feed reads the same roll-ups, so Level 1 and Level 3 figures come from the same transactions.

| Feature | What it does | Scorecard measure it feeds |
|---|---|---|
| Group supplier master | One KYS per supplier; SBU-level approval | Suppliers used by >1 SBU, share of spend |
| Common catalogue | Group item code + SBU local codes | Price variance, catalogue coverage |
| Price-variance report | Same item, same supplier, different SBUs | "Single clearest measure of unharvested scale" |
| Framework contracts | Group-negotiated price/terms; SBUs order against them | Spend through aggregated contracts, saving vs 5–10% target, group payment terms |
| Savings baseline | Snapshot of prices per item/supplier **before** framework contracts start | Makes the saving provable |
| Intra-group trade | An SBU registered as an internal supplier; POs flagged intra-group with the external benchmark price | Intra-group capture rate, value vs outside cost |
| Group buying desk (later) | Lets Thando Kinetics raise POs on behalf of other SBUs | Thando's intra-group share of work |

Likely intra-group flows: Khaya → contractors (cement), Masimba Stemrich → contractors (aggregate, precast), Fossil / Mangethe / Chimene → contractors (plant hire), Rhopower → Mandfar Electro and Persimmon (transformers, substations), Enviro Plastic → ProPlastics (recycled pellet), Titan → all sites (guarding), Kurima → hardware and solar, Thando → trucking.

## 10. Country rules

- **Zimbabwe:** ZIMRA tax clearance, PRAZ registration where relevant, NSSA.
- **South Africa:** B-BBEE certificate and level, CIDB grading (construction), SARS tax compliance PIN.
- **Eswatini:** local trading licence and tax registration.

The existing tiered KYS (`packages/shared/src/constants/kys.ts`) gains a country dimension.

## 11. Gate purchases (later)

Enviro Plastic buys waste for cash from informal pickers, and The Grain Hub likely buys grain from small farmers. Neither fits RFQ → PO. A separate flow records weighbridge weight, grade, price per kg, payee identity and cash-float reconciliation, without requiring full supplier KYS.

## 12. Branding

Done in phase 0: product name, logo, favicon, colours, login/register copy and email template now say Sourceline.

Still to do when SBUs exist: POs, GRVs, store-issue notes and RFQs print the **issuing SBU's** legal name, logo, address and VAT number from the registry. Until then they print `COMPANY_NAME` (default "Fossil Contracting").

## 13. Command-centre feed

A daily procurement KPI feed per SBU and division, keyed by command-centre SBU code: spend by category and currency, spend through framework contracts, savings vs baseline, price variance, supplier OTIF, creditor days (DPO), intra-group trade value and capture rate, open commitments, feed completeness. Served from the platform roll-ups.

## 14. Migration of existing Fossil data

Fossil's existing database **becomes the FOSSIL SBU database**. Group-wide records are copied out to the platform database **with their `_id`s unchanged**, so every existing reference still resolves.

### Steps

1. `mongodump` of production, kept.
2. Create the platform database and the `Sbu` registry (all 15, codes from command-centre `fixtures.ts`), with FOSSIL pointing at `fossil-procure-prod`.
3. Copy users → platform; each user's current `role` / `department` becomes a FOSSIL membership.
4. Copy supplier profiles and bank-change requests → platform; each supplier's current eligibility becomes a FOSSIL `SbuSupplier`.
5. Copy items → platform catalogue; Fossil's codes and `reorderLevel` become FOSSIL `SbuItem`s. Inventory stays in the Fossil database with balances kept as **opening balances** (one opening-balance stock transaction per item/site, so the ledger reconciles).
6. Delete transactions from the Fossil database: PurchaseRequisition, RFQ, Quotation, QuotationEvaluation, PurchaseOrder, Delivery, Invoice, Payment, StoreRequisition, StoreTransaction (except the new opening balances), StockTransfer, SupplierEvaluation, and notifications pointing at them. Department budgets keep their allocations with spend reset to zero. Audit-log entries are kept as history.
7. After verification, drop the copied collections (users, supplier profiles, bank-change requests, items) from the Fossil database.
8. Create the eleven other Zimbabwean SBU databases with indexes and an initial SBU admin each.

**Safety:** a `--dry-run` mode prints every count it would copy, keep and delete; it is rehearsed on a restored copy of production first; production runs only after sign-off on the dry-run output.

## 15. Build order

| Phase | Scope | Exit check |
|---|---|---|
| 0. Rebrand ✅ | Sourceline name, logo and colours across client, emails and documents | No "Tefoma" in product copy |
| 1. Multi-database foundation | Platform connection + SBU connections, request context, model resolvers, cross-database refs, `Sbu` registry, memberships, atomic counters, migration script | Fossil works as before on clean transactions; two-database isolation tests pass |
| 2. Multi-domain | SBU resolution from domain, JWT bound to SBU, registry-driven CORS, per-domain branding on login, group and supplier portals, email links per domain, DNS + Vercel domains | Fossil and one more SBU live on their own domains |
| 3. Group master data | `SbuSupplier`, `SbuItem`, group supplier master and catalogue screens, Zimbabwe compliance rules | All twelve Zimbabwean SBUs onboarded |
| 4. Per-SBU configuration | `ApprovalPolicy`, currency on all money documents, `FxRate`, SBU branding on printed documents | Each pilot SBU approves on its own chain and thresholds |
| 4b. South Africa | ZAR/SZL, South African compliance, onboarding ENVIRO_PLASTIC, MANGETHE, THANDO_KINETICS | SA SBUs transacting |
| 5. Synergy | Fan-out helper, nightly roll-ups, savings baseline, framework contracts, intra-group POs, price-variance report | First framework contract live; price variance visible across SBUs |
| 6. Command-centre feed | KPI feed from roll-ups | Command centre shows procurement spine from live data |
| 7. Gate purchases | Weighbridge / cash purchase flow | Enviro Plastic gate buying recorded in-system |

## 16. Open questions

1. **Base domain** for Sourceline (e.g. `sourceline.co.zw`) — is it registered, and who manages its DNS?
2. Which SBUs want their **own custom domain** rather than a Sourceline subdomain?
3. **Users and suppliers in the platform database (D5–D7)** — recommended so one person or supplier works across SBUs with one login and one KYS. The alternative, fully separate users and suppliers per SBU database, gives stronger separation but loses cross-SBU price variance by supplier and needs duplicate KYS.
4. Who is the **initial admin** for each of the eleven new SBUs?
5. Command-centre integration: pull API or scheduled push — and who owns the contract on that side?
6. Who holds group_procurement and chairman_office roles at launch?
7. Each pilot SBU's approval chain and thresholds (needed for phase 4).
