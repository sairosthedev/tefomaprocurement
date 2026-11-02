# Sourceline QA Test Pack

7 October 2026

Fifteen business units are live, each on its own address with its own separate database. Sign in at the business unit's address, and the login page knows which one you are in. A fresh business unit contains one administrator and nothing else, so section 3 comes before section 4.

## 1. Where to test

Each business unit has its own address and its own database. Open the address and the login page already knows which business unit you are in — there is no chooser to pick from.

Sign in as that unit's administrator. **Passwords are not in this document** — they are sent separately through a password manager. Change each one after first sign-in.

| Business unit | Address | Sign in as |
| --- | --- | --- |
| Fossil Contracting | fossil.sourceline.co.zw | admin@fossil.sourceline.local |
| Dokuma | dokuma.sourceline.co.zw | admin@dokuma.sourceline.local |
| Khayah Cement | khayah.sourceline.co.zw | admin@khayah-cement.sourceline.local |
| Kurima Centre | kurima.sourceline.co.zw | admin@kurima-centre.sourceline.local |
| Mandfar | mandfar.sourceline.co.zw | admin@mandfar.sourceline.local |
| Masimba | masimba.sourceline.co.zw | admin@masimba.sourceline.local |
| Persimmon | persimmon.sourceline.co.zw | admin@persimmon.sourceline.local |
| ProPlastics | proplastics.sourceline.co.zw | admin@proplastics.sourceline.local |
| Rhopower | rhopower.sourceline.co.zw | admin@rhopower.sourceline.local |
| The Grain Hub | grainhub.sourceline.co.zw | admin@grain-hub.sourceline.local |
| Titan | titan.sourceline.co.zw | admin@titan.sourceline.local |
| Trends | trends.sourceline.co.zw | admin@trends.sourceline.local |
| Enviro Plastic | enviro.sourceline.co.zw | admin@enviro-plastic.sourceline.local |
| Mangethe | mangethe.sourceline.co.zw | admin@mangethe.sourceline.local |
| Thando Kinetics | thando.sourceline.co.zw | admin@thando-kinetics.sourceline.local |

The API behind all of them is `api.sourceline.co.zw`. `sourceline.co.zw` on its own is the hosting company's page, not this system — do not test against it.

## 2. How sign-in works here

Sign-in is two steps: email and password, then a six-digit verification code.

**The code is filled in for you.** No email is sent and none will arrive. The server returns the code to the browser and the form completes itself. This is deliberate and temporary: the administrator accounts use made-up addresses that no mailbox can receive, so a real emailed code would lock everyone out.

Two consequences for testing:

- Do not raise "no verification email received" as a bug. It is the current configuration.
- Do not treat the system as secure in this state. Anyone who knows an email address can sign in as that person. It will be switched back once real addresses are in place, and two-factor sign-in needs retesting then.

If you want to test the real two-step flow, say so — it is one setting, but it needs real mailboxes first.

## 3. Set up a business unit first

Every business unit starts empty: one administrator, no sites, no departments, no staff, no suppliers. Dokuma right now holds 1 user, 0 sites and 0 departments. The procurement run-through needs seven different people, so create them before starting it.

Sign in as the administrator and create, in this order:

1. **A site** — for example Head Office. Everything is raised against a site.
2. **Departments** — at least two, and one of them must be Procurement. The approval chain in section 4 depends on a Procurement department existing.
3. **Users**, one per role below. Any email address works; nothing is sent to it.
4. **Suppliers** — at least three, so a request for quotation has something to compare. Each needs KYS marked complete and spend authorisation, or it cannot be awarded.

| Role | What they do in the run-through |
| --- | --- |
| End user | Raises the requisition |
| Department head (requesting department) | First approval |
| Department head (Procurement) | Second approval — a different person from the one above |
| Procurement officer | Runs the RFQ, awards, raises the purchase order |
| Finance | Approves the order, approves the invoice, records payment |
| COO | Approves orders above USD 5,000 |
| Stores officer | Receives goods, accepts them into stock |

The two department heads must be different people in different departments. A requisition raised inside Procurement skips a step, which is a separate case worth testing once the main run works.

If setting this up by hand for fifteen business units is too slow, ask for the seeding script to be run against a unit — it creates the site, four departments, all seven staff and six suppliers in one go.

## 4. The procurement run-through

This is the full cycle, from a person asking for something to the supplier being paid. It matches the automated test that currently passes end to end, so every step below is known to work — anything that fails is a real finding.

Sign out and in as the named role at each change of hands. Note the document number the system gives you at each stage; you need it to find the record at the next one.

### Onboard a supplier

1. **Supplier** registers through the link on the login page. They arrive pending.
2. **Procurement officer** sees them in the pending list, and activates them.
3. Mark the supplier KYS-complete and spend-authorised. Until both are set the supplier can be invited to quote but **cannot be awarded** — this is intended, and the error message says so.
4. **Supplier** signs in and completes their own profile.

### Raise and approve a requisition

5. **End user** creates a requisition as a draft, then submits it.
6. **Department head** of the requesting department approves it.
7. **Stores officer** confirms the goods are not already in stock and forwards it to procurement.
8. **Procurement officer** accepts it.

### Get quotes and award

9. **Procurement officer** creates a request for quotation, invites at least three active suppliers, and publishes it.
10. **Suppliers** submit quotations against it.
11. **Procurement officer** closes the RFQ once quotes are in.
12. **Department head** selects the winning quotation.
13. **Procurement officer** authorises it, then accepts it.

### Purchase order and its approvals

14. **Procurement officer** creates the purchase order from the accepted quotation, then submits it for approval.
15. **Department head** of the requesting department approves.
16. **Department head of Procurement** approves. This is a separate step and a separate person — missing it is the most common reason the next step refuses.
17. **Finance** approves.
18. **COO** approves, but only if the order is USD 5,000 or more. Below that the order skips this step. Test both: run one order over the threshold and one under it.
19. **Supplier** acknowledges the order.

### Receive, invoice, pay

20. **Stores officer** receives the goods, which raises a goods received note, then accepts them into inventory.
21. **Supplier** submits an invoice against the order.
22. **Finance** approves the invoice. It will be refused unless goods were actually receipted — the system matches the order, the receipt and the invoice, and the VAT must agree too.
23. **Finance** records payment.

### After the cycle

24. **Procurement officer** records a supplier evaluation; check the overall score computes between 1 and 5.
25. **Finance** views department budgets and confirms the spend is reflected.
26. **Administrator** views the audit log and confirms the cycle appears.
27. Check the end user received notifications along the way.

### Worth breaking on purpose

- Approve an invoice for goods that were never received. It should refuse.
- Award a supplier whose KYS is incomplete. It should refuse.
- Submit an invoice whose VAT does not match the order. It should flag a variance.
- Create two requisitions at the same moment in two browser tabs. They must get different numbers — duplicates here were a real bug and this is the check for it.

## 5. Separation checks

Each business unit has its own database. Nothing should ever cross between them, and a leak here matters more than any single broken screen. Set up two units — Dokuma and Titan, say — and try these.

| Check | What should happen |
| --- | --- |
| Sign in to Dokuma, then open titan.sourceline.co.zw in the same browser | Titan refuses the session and asks you to sign in again |
| Create a site with the same code in both units | Both succeed. Codes are unique within a unit, not across the group |
| Raise a purchase order in each unit | Both may be numbered PO-2026-00001. That is correct — numbering restarts per unit |
| Search Dokuma for a supplier that exists only in Titan | Not found |
| Sign in as a Titan user on the Dokuma address | Refused |
| Count users, suppliers and orders in each unit | Figures match only what you created in that unit |

If anything from one business unit appears in another, stop and report it immediately, with both addresses and what you saw. Treat it as the highest-severity finding in this pack.

## 6. Known gaps

These are deliberate or already known. Please do not raise them as bugs.

| What you will see | Why |
| --- | --- |
| No verification email arrives; the code fills itself in | Deliberate and temporary, see section 2 |
| Business units share no data at all — a supplier registered with one is unknown to the others | By design. Each unit keeps its own suppliers, users and items |
| The same supplier must be onboarded separately in every unit that uses them | Follows from the above |
| group.sourceline.co.zw and suppliers.sourceline.co.zw do not work | Group reporting and the shared supplier portal are not built |
| Documents print "Fossil Contracting" regardless of which unit issued them | Per-unit branding on printed documents is not built |
| Purchase order numbers repeat across units | Correct for now. A per-unit prefix is planned but not built |
| Emails link back to one fixed address, not the unit you are in | Per-unit email links are not built |
| No currency field on orders, invoices or payments | Only quotations carry a currency today |
| The USD 5,000 COO threshold applies to every unit | Per-unit approval thresholds are not built |

Fossil Contracting is the only unit expected to hold pre-existing data. The other fourteen were created empty.

## 7. Reporting a bug

Because fifteen separate databases are in play, a report without the business unit usually cannot be reproduced. Include all of these:

- **The address** you were on, in full, for example dokuma.sourceline.co.zw
- **The role** you were signed in as, and the email
- **The document number** — requisition, RFQ, order, invoice
- **What you did**, as the numbered step from section 4
- **What happened**, and what you expected
- **The exact error text**, not a description of it
- **The time**, so it can be matched to the server log

Anything in these three categories should be flagged as urgent rather than queued:

1. Data from one business unit visible in another.
2. An approval that can be skipped — particularly a purchase order reaching a supplier without Finance, or an invoice approved for goods never received.
3. Two documents issued the same number within one business unit.
