# Sourceline — Rollout Plan

27 October 2026

This plan takes Sourceline from a working platform that nobody uses yet to fifteen business units running their procurement on it, starting with Fossil Contracting and Dokuma.

It also sets out what the group must provide before any of it can be considered the group's system rather than a demonstration. That section is first, because nothing else is safe to start without it.

---

# Part 1 — What the group must provide

Sourceline currently runs on infrastructure that does not belong to the group. The domain is registered to another company, the hosting account is a personal one, and the database is on a free shared tier with no backups. That is appropriate for building and demonstrating a system. It is not appropriate for one holding the group's purchase orders, supplier bank details and payment records.

Everything below must be owned by the group, in the group's name, paid for by the group, with the group able to revoke any individual's access.

## 1.1 Why this matters

| If it stays as it is | What happens |
| --- | --- |
| Domain registered to another company | The group's procurement system is reachable only while that registration is maintained and that company consents |
| Hosting on a personal account | One person's account closure, dispute or lapse takes down every unit |
| Database on a free shared tier | No automated backup. A loss is permanent. The tier also has a hard ceiling the system is close to |
| Secrets held by one individual | Nobody else can operate, restore or audit the system |

None of these is a criticism of how it was built. They are the normal difference between a project and a system in service, and the transfer is the step that makes it the group's.

## 1.2 What is needed

### Domain

A domain owned and registered by the group, not by a supplier or an individual. Each unit gets its own subdomain: `fossil.<group domain>`, `dokuma.<group domain>`, and so on. One wildcard DNS record covers all fifteen.

The group must hold the registrar account and control DNS. If the group already owns a domain, a subdomain of it works equally well — `procurement.<group domain>` with units beneath it.

### Database

A managed MongoDB service, on the group's own account, on a paid tier.

| Requirement | Why |
| --- | --- |
| Automated daily backups, with a stated retention period | A free tier has none. This is the single largest risk today |
| Point-in-time recovery | So a mistake can be undone to the minute, not the day |
| Encryption at rest | Supplier bank details are held |
| No shared collection ceiling | The current tier caps at 500 collections; production alone needs about 334 |
| Separate clusters for production and for development and testing | Today they share one, so a test can exhaust production's capacity |

A free tier cannot meet the first four. This is the one line item that cannot be economised without accepting that financial records may be lost permanently.

### Hosting

Either keep the current hosting model on an account owned by the group, or host it on the group's own servers. Both work; they differ in cost and in who carries the operational burden.

| | Managed hosting, group account | Group's own server |
| --- | --- | --- |
| Setup | Hours | Days |
| Certificates | Automatic | Must be obtained and renewed |
| Scaling | Automatic | Manual |
| Needs | A billing account | A server, an operating system, a web server, a process manager, monitoring, patching |
| Suits | A group without dedicated infrastructure staff | A group with an IT team and a policy of hosting internally |

If the group's policy is to host internally, the system runs on any Linux server with Node.js: the API as a long-running process behind a reverse proxy, the client as static files. Two modest servers, or one with both, plus the managed database.

### Email

An account with a transactional email service, in the group's name, with the sending domain verified. The system sends sign-in codes, approval notifications and supplier invitations; without it, nobody can sign in once two-factor is on.

### Accounts and access

| # | Requirement |
| --- | --- |
| 1 | Every account — domain, database, hosting, email — created in the group's name with a group billing method |
| 2 | At least two named group administrators per account, so no single person is a point of failure |
| 3 | All secrets held in the group's password manager, not only in a deployment dashboard |
| 4 | A named system owner and a deputy |
| 5 | Written confirmation that the group can revoke any individual's access without losing service |

## 1.3 Handover checklist

| # | Item | Done when |
| --- | --- | --- |
| 1 | Group domain registered, DNS under group control | A unit's address resolves to the group's deployment |
| 2 | Paid database cluster on the group's account | A restore has been performed and timed |
| 3 | Separate cluster for development and testing | Production's capacity is unaffected by testing |
| 4 | Hosting on a group-owned account | A deploy runs from the group's account |
| 5 | Email service verified for the group's domain | A real sign-in code arrives |
| 6 | Secrets in the group's password manager | A second administrator can operate the system unaided |
| 7 | Code repository owned by the group | The group can grant and revoke developer access |
| 8 | System owner and deputy named | Both can perform the operations in the runbooks |

**Until items 1 to 5 are complete, no business unit should process real purchases.** Everything after this point assumes they are.

---

# Part 2 — What the system does

A walkthrough of the main screens, so the plan can be read by someone who has not seen it.

## 2.1 Signing in

Each business unit has its own address. Opening it identifies the unit, so there is nothing to choose. Sign-in is email and password, then a six-digit code.

![The login page at a business unit's own address. No unit chooser — the address already determined it. Suppliers register themselves through the link at the bottom.](screenshots/01-login.png)

## 2.2 Dashboards

Every role sees a dashboard built for what that role does. The procurement officer sees sourcing in progress; finance sees what is awaiting approval; an end user sees their own requests.

![The procurement officer's dashboard, showing what is in flight and what needs attention.](screenshots/02-dashboard-procurement.png)

![The administrator's dashboard: users, suppliers, open RFQs, orders pending approval, and a system overview.](screenshots/12-dashboard-admin.png)

## 2.3 Requisitions

Anyone can raise a requisition. It is approved by their department head, checked against stock by stores, then accepted by procurement for sourcing.

![Requisitions, filtered by where they are in the process.](screenshots/03-requisitions.png)

## 2.4 Sourcing — RFQs and quotations

Procurement publishes a request for quotation to invited suppliers. Suppliers quote through their own sign-in. The department head selects a winner and must record why.

![Requests for quotation, with their status and deadlines.](screenshots/04-rfqs.png)

![Quotations received, so prices can be compared side by side before an award.](screenshots/05-quotations.png)

## 2.5 Purchase orders and approvals

A purchase order is raised from the accepted quotation, then approved by the requesting department head, the head of Procurement, Finance, and — above the threshold — the COO.

![Purchase orders with their approval status. PO-2026-00001 is awaiting Finance; PO-2026-00002 is above the threshold and awaiting the COO.](screenshots/06-purchase-orders.png)

![Finance's approval queue.](screenshots/13-finance-approvals.png)

## 2.6 Goods receipt and stores

Stores records what physically arrived, accepts it into stock or rejects it. Stock, movements and transfers between sites are tracked.

![Goods received notes.](screenshots/17-deliveries-grv.png)

![Stock on hand by site, with reorder levels.](screenshots/18-inventory.png)

![Stock movements — every issue, receipt and adjustment.](screenshots/19-stock-movements.png)

## 2.7 Invoices, payments and budgets

A supplier invoices against the order. The invoice is matched against the order and against what stores actually receipted before finance can approve it.

![Supplier invoices awaiting matching and approval.](screenshots/14-invoices.png)

![Payments recorded against approved invoices.](screenshots/15-payments.png)

![Department budgets and what has been committed against them.](screenshots/16-budgets.png)

## 2.8 Administration and audit

Administrators manage users, departments and sites. Every significant action is recorded and the record survives a data reset.

![Staff and their roles.](screenshots/08-staff.png)

![Departments.](screenshots/09-departments.png)

![Sites.](screenshots/10-sites.png)

![The audit log — who did what, and when.](screenshots/11-audit-log.png)

## 2.9 Reporting

Supplier performance, due diligence completeness, evaluation scores and spend.

![Reports, including supplier performance and compliance.](screenshots/07-reports.png)

## 2.10 The controls, in short

These are what the system is for.

| Control | What it enforces |
| --- | --- |
| Three quotations before an award | Fewer requires a recorded waiver naming a reason from a fixed list |
| An approval chain that lengthens with value | Department head, Procurement head, Finance, and the COO above USD 5,000 |
| Three-way match before payment | The invoice must agree with the order and with what stores actually receipted |
| Supplier eligibility | A supplier may be invited to quote while diligence is in progress, but cannot be awarded until it is complete and spend-authorised |
| Separation between units | Each unit has its own database; a session in one is refused by another |

---

# Part 3 — The rollout

## 3.1 Where things stand

| | Status |
| --- | --- |
| Fifteen units deployed, own addresses, valid certificates | Done |
| Unit identified by address; sessions cannot cross units | Done and verified |
| Full procurement cycle, 50 steps, against live production | Passed |
| Infrastructure owned by the group | **No — see Part 1** |
| Database backups | **No** |
| Units populated with real data | Only Dokuma, and only with test data |
| Administrator accounts able to receive email | No — addresses are not real |
| Two-factor sign-in | Switched off |

## 3.2 Principles

**Fossil and Dokuma first, both all the way.** Two units teach more than one — the first proves the process works, the second proves it transfers. Both complete before any third unit starts.

**A unit is live only when a real purchase completes in it.** Not when accounts exist.

**Stop if the pilot teaches something.** The point of a pilot is to change the plan.

**Nothing irreversible without a backup.** Part 1 before Part 3.

## 3.3 Phase 0 — Infrastructure and blockers

Nothing starts until these are done.

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| 0.1 | Complete the handover checklist in 1.3 | Group IT, Technical | All eight items signed off |
| 0.2 | Restore a backup into a scratch environment and time it | Technical | A restore has actually been performed |
| 0.3 | Move the units to the group's domain | Technical | Each unit resolves at a group address |
| 0.4 | Deploy the pending dashboard fix | Technical | Department heads outside Procurement can load their dashboard |
| 0.5 | Real administrator addresses, real passwords | Business, Technical | A password reset email arrives |
| 0.6 | Switch two-factor sign-in on | Technical | A real emailed code is required |
| 0.7 | Correct the client address used in emails | Technical | A notification links to a working address |

**Exit test.** An administrator signs out, requests a password reset, receives the email, resets, and signs back in with a real emailed code — on a group-owned address.

Until 0.6 is done, anyone who knows an email address can sign in as that person, finance included. Acceptable for testing; not for live purchasing.

## 3.4 Phase 1 — Fossil and Dokuma

Both units, in parallel, real people, real purchases, three weeks.

Fossil is the original business and carries the most history and expectation. Dokuma is a clean start. Running them together surfaces both the migration questions and the greenfield ones at the same time, while the team is still close to the work.

### Prepare, per unit

| # | Task | Owner |
| --- | --- | --- |
| 1.1 | Clear test data from the unit | Technical |
| 1.2 | Create real sites and departments | Unit admin |
| 1.3 | Create real users, one per role, real addresses | Unit admin |
| 1.4 | Onboard real suppliers with diligence completed | Procurement |
| 1.5 | Load the catalogue and opening stock balances | Stores |
| 1.6 | Set department budgets | Finance |
| 1.7 | **Confirm the approval threshold and chain match the unit's real delegation of authority** | Finance, COO |
| 1.8 | Train each role, using the unit's own data | Business |

Item 1.7 is the one most often skipped and most expensive to find later. The system enforces USD 5,000 and a four-stage chain because that is how it was built. If a unit's real authority limits differ, it will enforce the wrong rule faithfully.

Fossil has an additional question: what happens to purchases already in progress, and to historical records. The recommendation in 3.7 is that in-flight work finishes in the old process.

### Run

Both units process real procurement through Sourceline for three weeks. The old process stays available as a fallback but is not run in parallel — doing both doubles the work and guarantees neither is trusted.

### Exit tests, each unit

1. At least ten real requisitions have reached payment.
2. At least one purchase above the threshold has passed all four approvals.
3. At least one invoice has been correctly refused for goods not receipted.
4. Stock figures agree with a physical count.
5. Finance confirms the budget figures match their own records.
6. The separation checks in 3.6 pass between the two units.
7. No unresolved issue rated urgent.

### Decide

Hold a review. Proceed, proceed after fixes, or stop. Write down which and why.

## 3.5 Phases 2 to 4

**Phase 2 — three units, two weeks.** Khayah Cement, Titan and Kurima Centre. Chosen because they differ from each other and from the pilot pair: a cement producer, a services business, a retailer.

**Phase 3 — the remaining seven Zimbabwean units, four weeks.** Mandfar, Masimba, Persimmon, ProPlastics, Rhopower, The Grain Hub, Trends. Two a week, using the checklist.

**Phase 4 — the three South African units.** Enviro Plastic, Mangethe, Thando Kinetics. These need work the others do not: South African supplier compliance and ZAR. Currency is not yet carried on orders, invoices or payments, so Phase 4 depends on that being built. It is deliberately left undated.

### The per-unit checklist

| # | Step | Owner |
| --- | --- | --- |
| 1 | Confirm the unit's address resolves and serves over HTTPS | Technical |
| 2 | Build the unit's indexes | Technical |
| 3 | Real administrator address and password | Technical |
| 4 | Sites and departments | Unit admin |
| 5 | Users, one per role, real addresses | Unit admin |
| 6 | Confirm the approval chain against the unit's delegation of authority | Unit finance |
| 7 | Suppliers onboarded, diligence complete, spend-authorised | Unit procurement |
| 8 | Catalogue and opening stock | Unit stores |
| 9 | Department budgets | Unit finance |
| 10 | Train each role | Business |
| 11 | One complete purchase as a rehearsal | Unit |
| 12 | Confirm the unit sees no other unit's data | Technical |

## 3.6 Separation checks, each time a unit goes live

Run against every pair of live units. A leak found after four units are live is four times the problem.

- A session opened in one unit is refused by another.
- A supplier added in one does not appear in the other.
- Document numbers restart per unit — expected, not a collision.
- A user of one unit cannot sign in at another's address.

## 3.7 Cutover and fallback

**Cutover is per unit.** A unit switches when its rehearsal passes.

**In-flight work stays where it started.** Purchases already under way finish in the old process. Sourceline takes new requisitions only. Migrating half-finished purchases is more error-prone than letting them drain.

**Fallback** is the old process for that unit alone, available for the first month. The trigger is a defect that stops purchasing with no workaround within a day.

## 3.8 Training

One session per role, not per unit.

| Audience | Length | Covers |
| --- | --- | --- |
| End users | 15 min | Raise a requisition, track it, read notifications |
| Department heads | 30 min | Approve requisitions and orders, select a winner with justification |
| Procurement | 60 min | Sourcing, RFQs, award, orders, supplier diligence |
| Finance | 45 min | Order approval, three-way match, invoices, payments, budgets |
| Stores | 45 min | Stock checks, receipt, acceptance and rejection, transfers |
| COO | 15 min | Authorising above the threshold, and what the figures mean |
| Suppliers | 20 min | Registering, diligence, quoting, acknowledging, invoicing |

Supplier training is the one usually forgotten. Suppliers who cannot quote get chased by telephone, and the competitive-quotation control quietly lapses.

## 3.9 Risks

| Risk | Consequence | What reduces it |
| --- | --- | --- |
| Infrastructure stays on personal accounts | The group's records depend on an individual's account | Part 1, before anything |
| No database backup when the first real purchase is recorded | Unrecoverable loss of financial records | Phase 0.1 and 0.2 |
| Approval thresholds do not match real delegated authority | The wrong rule enforced faithfully, on real money | Step 6 of the checklist |
| Suppliers do not use the portal | Quotes collected by telephone; the competitive control lapses | Supplier training; monitor quotes per RFQ |
| Units go live before the pilot is reviewed | One defect repeated fifteen times | Phase gates and the authority to stop |
| The shared cluster reaches its ceiling | Writes fail in every unit, production included | A separate cluster for testing |

## 3.10 Indicative timeline

Assumes the infrastructure handover is prompt and the pilot does not force a change of plan.

| Phase | Duration | Cumulative |
| --- | --- | --- |
| 0 — Infrastructure handover and blockers | 2 weeks | Week 2 |
| 1 — Fossil and Dokuma | 3 weeks | Week 5 |
| Review and fixes | 1 week | Week 6 |
| 2 — Three units | 2 weeks | Week 8 |
| 3 — Seven Zimbabwean units | 4 weeks | Week 12 |
| 4 — South African units | Depends on currency support | — |

Twelve units live in about twelve weeks. Phase 4 is unscheduled because it depends on work not yet built, and a date would be a guess presented as a plan.

Phase 0 is two weeks rather than one because it now includes the infrastructure handover, most of which is waiting on accounts, billing approvals and DNS rather than on work.
