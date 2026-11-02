# Sourceline Procurement System

26 October 2026

Sourceline is a procurement and stores system for a group of fifteen business units. It takes a purchase from the moment somebody asks for something to the moment the supplier is paid, and it refuses to let that happen out of order.

Each business unit runs on its own address with its own separate database. A person signing in at `khayah.sourceline.co.zw` is in Khayah Cement and can see nothing belonging to any other unit.

## 1. What problem it solves

Procurement spends money on behalf of someone else, which is why it is nearly always governed by a written procedure, and why the procedure is nearly always worked around when it lives in email and spreadsheets. The controls that matter are the dull ones: three quotes before an award, approval by the right people in the right order, and payment only against goods actually received.

Sourceline puts those controls in the path of the work rather than in a document beside it. The system will not let a purchase order reach a supplier without the approvals the value requires, and will not let an invoice be paid for goods nobody receipted.

## 2. What it does

| Area | What it covers |
| --- | --- |
| Requisitions | Anyone can raise one; it is approved by their department head, checked against stock, then accepted by procurement |
| Sourcing | Requests for quotation to invited suppliers, quotations received and compared, award with a recorded justification |
| Purchase orders | Raised from the accepted quotation, approved through a chain that lengthens with value, then issued to the supplier |
| Goods receipt | Stores records what physically arrived, accepts it into stock or rejects it |
| Invoicing and payment | Supplier invoices against the order; a three-way match gates approval; payment is recorded |
| Suppliers | Self-registration, due diligence (KYS) by tier, document expiry tracking, bank-change control, periodic evaluation |
| Stores | Catalogue, stock on hand by site, issues, transfers between sites, reorder levels and low-stock alerts |
| Oversight | Budgets by department, an audit log of every action, dashboards per role, supplier performance reports |

## 3. The controls

These are the parts worth understanding, because they are what the system is for.

**Three quotations before an award.** The default is three. Fewer is permitted only with a recorded waiver, and the waiver must name a reason from a fixed list — single source, approved contract, no quotes received, unique product, custom manufacture, and so on. The reason is kept with the award.

**An approval chain that lengthens with value.** A purchase order goes to the requesting department's head, then the head of Procurement, then Finance. Above USD 5,000 it also needs the COO. Each stage is a different person; skipping one is refused rather than warned about.

**Three-way match before payment.** An invoice is checked against the purchase order and against what stores actually receipted. Goods must have been received and accepted — not merely ordered — before finance can approve. VAT is reconciled separately. A variance can be overridden, but only with a written reason, which is kept on the invoice and in the audit log.

**Supplier eligibility.** A supplier may be invited to quote while its due diligence is still in progress, because asking for a price commits nothing. It cannot be *awarded* or issued a purchase order until its KYS is complete and it is marked spend-authorised. Diligence is tiered: a critical supplier carries the full checklist, a minor one a proportionate subset, and each tier has its own re-evaluation interval.

**Separation between business units.** Each unit has its own database. A session opened against one is refused by another. Document numbering restarts in each unit, so two units may both hold PO-2026-00001 — correct, not a collision.

## 4. The procurement cycle, step by step

| # | Step | Who |
| --- | --- | --- |
| 1 | Supplier registers, or is created by procurement | Supplier / Procurement officer |
| 2 | Due diligence completed and the supplier marked spend-authorised | Procurement officer |
| 3 | Requisition raised as a draft, then submitted | End user |
| 4 | Requisition approved | Department head |
| 5 | Checked against stock; issued from stores if available, otherwise forwarded | Stores officer |
| 6 | Requisition accepted for sourcing | Procurement officer |
| 7 | Request for quotation published to invited suppliers | Procurement officer |
| 8 | Quotations submitted | Suppliers |
| 9 | RFQ closed once quotes are in | Procurement officer |
| 10 | Winning quotation selected, with a written justification | Department head |
| 11 | Award authorised and accepted | Procurement officer |
| 12 | Purchase order raised from the accepted quotation and submitted | Procurement officer |
| 13 | Approved — requesting department head | Department head |
| 14 | Approved — head of Procurement | Procurement head |
| 15 | Approved — Finance | Finance |
| 16 | Authorised — COO, only at USD 5,000 or above | COO |
| 17 | Purchase order acknowledged | Supplier |
| 18 | Goods received; a goods received note is raised | Stores officer |
| 19 | Goods accepted into stock, or rejected | Stores officer |
| 20 | Invoice submitted against the order | Supplier |
| 21 | Three-way match; invoice approved | Finance |
| 22 | Payment recorded | Finance |
| 23 | Supplier evaluated and scored | Procurement officer |

Steps 13 to 16 are the chain that lengthens with value. Step 16 is skipped below the threshold.

## 5. Who uses it

| Role | What they do |
| --- | --- |
| End user | Raises requisitions for their department and tracks them |
| Department head | Approves their department's requisitions and purchase orders; selects the winning quotation |
| Procurement officer | Runs sourcing, awards, raises purchase orders, manages suppliers |
| Head of Procurement | A department head who also approves every purchase order at the second stage |
| Finance | Approves orders, approves invoices against the three-way match, records payments, manages budgets |
| COO | Authorises purchase orders at or above USD 5,000 |
| Stores officer | Checks stock, receives goods, accepts or rejects, manages inventory and transfers |
| Supplier | Registers, completes due diligence, quotes, acknowledges orders, invoices |
| Administrator | Manages users, departments and sites, and reads the audit log |

## 6. How it is built

A TypeScript monorepo with three workspaces: the API, the web client, and a shared package of constants and rules used by both so the two cannot disagree about a status name or a threshold.

| Layer | Technology |
| --- | --- |
| API | Node.js, Express 4, TypeScript 5.5 |
| Database | MongoDB (Atlas), Mongoose 8 |
| Web client | React 18, Vite 5, React Router 7, Tailwind CSS 3 |
| Shared rules | A workspace package consumed by both sides |
| Authentication | JSON Web Tokens, bcrypt password hashing, a six-digit code as a second factor |
| Email | Resend |
| Documents | PDFKit for printed purchase orders and notes |
| Spreadsheets | SheetJS, for bulk supplier and stock import |
| Hosting | Vercel — the API as serverless functions, the client as a static build |
| Tooling | tsx, Prettier, concurrently, cross-env |

**Size.** About 30,000 lines in the API across 291 files, 28,000 in the client across 107, and 1,400 in the shared package. 28 data models, 171 API endpoints, 42 screens.

## 7. How the multi-entity part works

The system began as one database for one company. It now serves fifteen, and the change had to be made without rewriting the 182 files that read and write data.

**The registry.** A central database holds one record per business unit: its code, its database name, its domains, its branding. Nothing else is shared.

**Resolution by hostname.** A request arriving at `dokuma.sourceline.co.zw` is matched against the registry, and everything that follows runs against Dokuma's database. The login page needs no chooser, because the address already said which unit.

**Model resolvers.** Each data model is a proxy that resolves, per request, to the copy bound to the current unit's database connection. Existing code was untouched; `PurchaseOrder.find()` means something different depending on who is asking.

**Fail closed.** Using a model with no business unit in context raises an error rather than reading whichever database happens to be open. There is no "all units" query — group-wide reporting has to fan out deliberately.

**Sessions are bound to their unit.** A token issued for one unit is refused by another, so a session cannot be carried across by changing the address.

## 8. Running and operating it

| Command | What it does |
| --- | --- |
| `npm run dev` | API on :3001 and client on :5173, both watching |
| `npm run typecheck` | Type-checks all three workspaces |
| `npm run check:isolation` | Proves two business units cannot see each other's data |
| `npm run check:numbering` | Proves concurrent documents get distinct numbers |
| `npm run e2e:local -- --sbu CODE <url>` | The full 50-step procurement cycle against a live API |
| `npm run seed:demo:prod -- --sbu CODE` | Test accounts, suppliers, catalogue and stock |
| `npm run seed:sbu-registry:prod -- --all` | Registers every business unit |
| `npm run bootstrap:sbus:prod -- --with-indexes` | Creates a unit's database, indexes and first administrator |
| `npm run sbu:domains:prod -- --base <domain>` | Assigns each unit its hostname |
| `npm run sbu:capacity` | Reports the cluster's collection budget |
| `npm run deploy:production` | Deploys API and client |

Background jobs run on a schedule and raise alerts for low stock, approaching RFQ deadlines, expiring supplier documents and suppliers due for re-evaluation.

## 9. What is deliberately not built yet

| Not built | Consequence today |
| --- | --- |
| Group-wide reporting across units | No single view of spend across the group |
| A shared supplier portal | A supplier works with each unit separately |
| Per-unit branding on printed documents | Every document prints "Fossil Contracting" |
| An SBU prefix on document numbers | Numbers repeat across units |
| Currency on orders, invoices and payments | Only quotations carry a currency |
| Per-unit approval thresholds | USD 5,000 applies everywhere |
| Per-unit links in emails | Every email links to one fixed address |

Two of these follow from a deliberate decision that business units share no data at all. That gives the strongest separation available, and it is why a supplier must be onboarded in each unit that trades with it.

## 10. Where things stand

The platform is deployed and working. All fifteen units serve over HTTPS on their own hostnames, sign-in works, and the complete procurement cycle has been run end to end against the live system — fifty steps, no failures. Business units cannot see each other's data.

What remains before the group can use it in earnest is set-up rather than software: fourteen of the fifteen units are still empty, the administrator accounts cannot yet receive email, and two-factor sign-in is switched off while that is true. The database tier also needs confirming, because a shared tier carries no automated backup and the system is about to hold real payment records.
