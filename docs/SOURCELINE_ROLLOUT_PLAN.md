# Sourceline — Rollout Plan

27 October 2026

This plan takes Sourceline from a working platform that nobody uses yet to fifteen business units running their procurement on it. It is written to be executed, so every phase has an exit test somebody can actually perform.

The platform is further along than the rollout. All fifteen units are deployed, reachable over HTTPS on their own addresses, and the complete procurement cycle has been run end to end against the live system. What is missing is not software.

## 1. Where things stand

| | Status |
| --- | --- |
| Fifteen units deployed, own hostnames, valid certificates | Done |
| Unit identified by hostname; sessions cannot cross units | Done and verified |
| Full procurement cycle, 50 steps, against live production | Passed |
| Units populated with real data | Only Dokuma, and only with test data |
| Administrator accounts able to receive email | No — addresses are not real |
| Two-factor sign-in | Switched off |
| Database backups | Unconfirmed; the tier suggests none |
| A fix for a broken dashboard | Committed, not deployed |

Four of those seven are blockers. None of them is a code change.

## 2. Principles

**One unit all the way before any unit partially.** Fifteen half-configured units teach nothing and generate fifteen times the confusion. Dokuma goes first, end to end, with real people.

**A unit is live only when a real purchase completes in it.** Not when accounts exist. The exit test for every phase is a genuine requisition reaching payment.

**Stop the wave if the pilot teaches something.** The point of a pilot is to change the plan. Build in the time to act on it.

**Nothing irreversible without a backup.** The migration that clears transactions, and the first real purchase, both assume the data can be recovered. Until that is confirmed, neither should happen.

## 3. Phase 0 — Clear the blockers

Nothing else starts until these are done. Estimated: three to five working days, most of it waiting on others.

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| 0.1 | Confirm the Atlas tier and whether automated backups exist | Technical | Written confirmation of backup frequency and retention |
| 0.2 | If there are none, move production to a tier that has them | Technical | A restore has been tested, not just enabled |
| 0.3 | Move development and staging to a separate cluster | Technical | Production's collection budget is no longer shared |
| 0.4 | Deploy the pending dashboard fix | Technical | Department heads outside Procurement can load their dashboard |
| 0.5 | Decide the administrator email addresses for all fifteen units | Business | A named, working mailbox per unit |
| 0.6 | Replace the placeholder addresses and set real passwords | Technical | Each administrator can receive a password reset |
| 0.7 | Switch two-factor sign-in back on | Technical | A real emailed code is required to sign in |
| 0.8 | Correct CLIENT_URL so email links resolve | Technical | A notification email links to a working address |

**Exit test.** An administrator in any unit signs out, requests a password reset, receives the email, resets, signs back in with a real emailed verification code.

Until 0.7 is done the system is not secure: anyone who knows an email address can sign in as that person, finance included. That is acceptable for testing and not for live purchasing.

## 4. Phase 1 — Pilot: Dokuma

One unit, real people, real purchases, for two to three weeks.

### Prepare

| # | Task | Owner |
| --- | --- | --- |
| 1.1 | Clear the test data from Dokuma | Technical |
| 1.2 | Create Dokuma's real sites and departments | Dokuma admin |
| 1.3 | Create real users with real email addresses, one per role | Dokuma admin |
| 1.4 | Onboard ten to fifteen real suppliers, with due diligence completed | Procurement |
| 1.5 | Load the item catalogue and opening stock balances | Stores |
| 1.6 | Set department budgets for the current year | Finance |
| 1.7 | Confirm the approval threshold and chain match Dokuma's actual delegation of authority | Finance, COO |
| 1.8 | Train each role — one session, by role, using their own data | Business |

Item 1.7 is the one most often skipped and most expensive to discover later. The system enforces USD 5,000 and a four-stage chain because that is what it was built with; if Dokuma's real authority limits differ, the system will enforce the wrong rule faithfully.

### Run

Dokuma processes its real procurement through Sourceline for two to three weeks, with the old process kept as a fallback but not used in parallel. Running both doubles the work and guarantees neither is trusted.

### Exit tests

1. At least ten real requisitions have reached payment.
2. At least one purchase above the COO threshold has gone through all four approvals.
3. At least one invoice has been correctly refused for goods not receipted.
4. Stores has received goods and the stock figures match a physical count.
5. Finance confirms the budget figures agree with their own records.
6. No unresolved issue rated urgent.

### Decide

Hold a review. Three outcomes are legitimate: proceed, proceed after fixes, or stop. Write down which and why.

## 5. Phase 2 — First wave: three units

Khayah Cement, Titan and Kurima Centre. Chosen because they differ from each other and from Dokuma — a cement producer, a services business and a retailer — so the second wave is informed by variety rather than repetition.

Run the per-unit checklist in section 7, three units in parallel, two weeks.

**Exit test.** Each unit has completed five real purchases to payment, and the separation checks in section 8 pass across all four live units.

## 6. Phase 3 and 4 — The remainder

**Phase 3:** the other eight Zimbabwean units — Fossil, Mandfar, Masimba, Persimmon, ProPlastics, Rhopower, The Grain Hub, Trends. Two units a week, using the checklist.

**Phase 4:** the three South African units — Enviro Plastic, Mangethe, Thando Kinetics. These need work Phases 1 to 3 do not: South African supplier compliance (B-BBEE, CIDB, SARS), and ZAR. Currency is not yet carried on orders, invoices or payments, so treat Phase 4 as dependent on that being built, not as another wave.

Fossil is in Phase 3 rather than first despite being the original business, because it is the unit most likely to carry historical data and expectations, and is better done once the process is proven.

## 7. The per-unit checklist

Repeatable for every unit after the pilot.

| # | Step | Owner |
| --- | --- | --- |
| 1 | Confirm the unit's hostname resolves and serves over HTTPS | Technical |
| 2 | Build the unit's indexes | Technical |
| 3 | Set a real administrator address and password | Technical |
| 4 | Create sites and departments | Unit admin |
| 5 | Create users, one per role, real addresses | Unit admin |
| 6 | Confirm the approval chain and threshold against the unit's delegation of authority | Unit finance |
| 7 | Onboard suppliers with due diligence completed and spend authorisation | Unit procurement |
| 8 | Load the catalogue and opening stock | Unit stores |
| 9 | Set department budgets | Unit finance |
| 10 | Train each role | Business |
| 11 | Run one complete purchase, start to payment, as a rehearsal | Unit |
| 12 | Confirm the unit sees no other unit's data | Technical |

A unit is live when step 11 passes with real people and real money.

## 8. Separation checks, each time a unit goes live

These run against every pair of live units, and they are not optional. A leak discovered after four units are live is four times the problem.

- A session opened in one unit is refused by another.
- A supplier added in one does not appear in the other.
- Document numbers restart per unit, and that is expected rather than a collision.
- A user of one unit cannot sign in at another's address.

## 9. Training

One session per role rather than one session per unit. The end user's session is fifteen minutes; the procurement officer's is an hour.

| Audience | Covers |
| --- | --- |
| End users | Raise a requisition, track it, read notifications |
| Department heads | Approve requisitions and orders, select a winning quotation with justification |
| Procurement | Sourcing, RFQs, award, purchase orders, supplier due diligence |
| Finance | Order approval, the three-way match, invoices, payments, budgets |
| Stores | Stock checks, goods receipt, acceptance and rejection, transfers |
| COO | Authorising above the threshold, and what the figures mean |
| Suppliers | Registering, completing due diligence, quoting, acknowledging, invoicing |

Supplier training is the one usually forgotten. Suppliers who cannot quote will be chased by telephone and the competitive-quotation control quietly lapses.

## 10. Cutover and fallback

**Cutover is per unit, not group-wide.** A unit switches when its rehearsal passes.

**In-flight work stays where it started.** Purchases already under way in the old process finish there. Sourceline starts with new requisitions only. Migrating part-finished purchases is more error-prone than letting them drain.

**Fallback** is the old process, unchanged, for that unit alone. It stays available for the first month after a unit goes live. The trigger for using it is a defect that stops purchasing and has no workaround within a day.

## 11. Risks

| Risk | Consequence | What reduces it |
| --- | --- | --- |
| No database backup when the first real purchase is recorded | Unrecoverable loss of financial records | Phase 0.1 and 0.2, before anything else |
| Approval thresholds do not match real delegated authority | The system enforces the wrong rule, faithfully, on real money | Step 6 of the per-unit checklist |
| Suppliers cannot or will not use the portal | Quotations collected by telephone; the competitive control lapses | Supplier training, and monitoring quote counts per RFQ |
| Units go live in parallel before the pilot is reviewed | The same defect is repeated fifteen times | Phase gates, and the authority to stop |
| Administrators keep placeholder addresses | No password resets, no approval notifications | Phase 0.5 and 0.6 |
| The shared cluster reaches its ceiling | Writes fail in every unit, production included | Phase 0.3 |

## 12. Indicative timeline

Assumes blockers are cleared promptly and the pilot does not force a change of plan.

| Phase | Duration | Cumulative |
| --- | --- | --- |
| 0 — Clear blockers | 1 week | Week 1 |
| 1 — Dokuma pilot | 3 weeks | Week 4 |
| Review and fixes | 1 week | Week 5 |
| 2 — First wave, three units | 2 weeks | Week 7 |
| 3 — Eight Zimbabwean units | 4 weeks | Week 11 |
| 4 — South African units | Depends on currency support | — |

Twelve units live in about eleven weeks. Phase 4 is deliberately unscheduled: it depends on work that has not been built, and putting a date on it would be a guess presented as a plan.
