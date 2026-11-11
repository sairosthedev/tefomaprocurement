# Procureline end-to-end tests (Playwright)

Browser tests that follow the **Project Scope Document v1.0** and the **QA Testing Guide (4 Nov 2026)**. They run against the live test units, **Dokuma** and **Fossil** only, with the guide's test accounts (password `Test@1234`).

> These sign-ins work on the live system. Keep this folder and its reports with testers.

## Setup

```bash
cd Tests
npm install
npx playwright install chromium
```

## Running

| Command | What it runs |
|---|---|
| `npm test` | Everything, on Dokuma then Fossil |
| `npm run test:dokuma` / `npm run test:fossil` | One unit |
| `npm run test:smoke` | Sign-in, role access and unit isolation (creates almost nothing) |
| `npm run test:flow` | The main 21-step run-through, above and below the COO limit |
| `npm run test:headed` | Everything with a visible browser |
| `npm run report` | Open the last HTML report |

Settings you can override with environment variables:

| Variable | Default |
|---|---|
| `QA_INITIALS` | `PW`. Every title starts `QA-<initials> <run id>`, as the guide asks |
| `QA_PASSWORD` | `Test@1234` |
| `DOKUMA_URL`, `FOSSIL_URL` | `https://dokuma.sourceline.co.zw`, `https://fossil.sourceline.co.zw` |
| `QA_API_URL` | `https://api.sourceline.co.zw` |
| `QA_COO_LIMIT` | `5000` (USD) |
| `QA_BROWSER_CHANNEL` | unset. Set `msedge` or `chrome` to use an installed browser instead of Playwright's Chromium |
| `QA_VIDEO` | unset. Set `1` to keep a video of failed tests |

## What is covered

| Spec | Guide section | Checks |
|---|---|---|
| `01-sign-in.spec.js` | Signing in, Test accounts | Every role signs in with password and auto-filled code; wrong password refused; sign-out; each role is refused other roles' pages |
| `02-main-run-through.spec.js` | The main run-through, steps 1–21 | Run twice: an order of USD 5,000 or more (COO approves) and one below (COO never sees it) |
| `03-other-paths.spec.js` | Other paths | Head's own requisition goes straight to stores; in-stock item issued with no procurement step; Fossil PPE and timber invitations; mixed currencies not ranked; Needs attention counts match the lists |
| `04-must-be-refused.spec.js` | Must be refused | Self-approval; cross-department approval; uncategorised forward; sealed bids; award with under 3 quotes; Head of Procurement authorising their own selection; COO before Finance; VAT variance; invoice with no GRV; concurrent numbering |
| `05-unit-isolation.spec.js` | The two units stay apart | Other unit's user refused; other unit's token refused; other unit's requisition not found; separate supplier lists |

### Data carried from one role to the next

Each step signs in as the role that owns it (in its own browser context, like the guide's "second browser or private window") and first checks that what the earlier role entered appears unchanged: requisition title, description, work order, package, quantity, unit and specification; the RFQ title, description and lines as the supplier sees them; each quote's unit price, total, delivery days, payment terms and notes; the buyer's justification on the Head of Procurement's queue; the PO's supplier, lines and total for every approver and for the supplier; the delivery note and driver on the GRV; the GRV number on Finance's three-way match; the supplier's own invoice number back in the supplier's view.

Some data the app never shows again, so it cannot be asserted after entry: PO notes and terms and conditions, GRV witnesses, inspector and MSDS, the person who collected from stores, and evaluation notes. The tests check them on the review step before saving.

## Layout

```
Tests/
  playwright.config.js   one project per unit (dokuma, fossil), one worker
  data/units.js          addresses, accounts, suppliers and goods per unit
  data/scenarios.js      everything one main run-through enters
  fixtures/test.js       `unit` and `signInAs(role)` fixtures
  pages/                 page objects (BasePage, LoginPage, Requisitions, Sourcing, PurchaseOrder, ReceivePay)
  utils/                 test data helpers, API client for server-side refusals, shared short flows
  tests/                 the specs
```

## Known app bugs these tests report (found 11 Nov 2026)

Tests marked `test.fail()` pass while the bug is present; Playwright reports them once it is fixed, and the marker can be removed. The others fail until the bug is fixed.

| Test | Bug | How it is marked |
|---|---|---|
| 01 · Signing out before the page finishes loading | A late `/auth/me` reply restores the session after logout (`AuthContext.initAuth`); the server never ends the session | `test.fail()` |
| 02 · step 22 | GRV "Received by" shows "undefined undefined" | `test.fail()` |
| 02 · step 23 | A saved evaluation shows the raw status `pending_hod`, though the page says there is no approval step | `test.fail()` |
| 04 · A buyer can re-select a quote the Head of Procurement selected | Once the Head of Procurement selects a quote nobody can authorise it on screen; the award is stuck | `test.fail()` |
| 03 · stores Needs attention: Items at or below reorder level | Dashboard counts only active catalogue items; Inventory counts all, so the numbers differ | Fails |
| 04 · Two requisitions submitted at the same moment | Both get the same number; one fails with a raw database error naming the production database | Fails |

## Running headed on Windows with Application Control

If Windows blocks Playwright's own Chromium ("An Application Control policy has blocked this file"), run on Edge:

```bash
QA_BROWSER_CHANNEL=msedge npx playwright test --headed --workers=1
```

## Notes

- Specs run in order inside a file (`test.describe.serial`): each step needs the document the step before produced. If a step fails, the rest of that run is skipped. Document numbers are printed at the end of each run.
- Two cases are marked `fixme` because the test units cannot produce them yet: awarding a supplier whose KYS is incomplete (no such supplier on the test units) and handing over more than is in stock.
- A supplier evaluated recently is not "due" again, so step 21 skips itself rather than fail.
- Not bugs (per the guide): no verification email; PO numbers repeating across units; dashboards taking a few seconds on the first load.
