# Procureline Procurement — A step-by-step walkthrough of the system
30 October 2026

## About this walkthrough

This document follows one purchase from start to finish, through every stage of the procurement cycle. At each stage it shows the screen the person sees and explains what they do, and what the system checks before letting the purchase move on.

All screenshots are from the live system, running in a test copy of the **Dokuma** business unit with sample data. The people, suppliers and amounts are made up, but every record was created by the real system, signed in as the real role. The grey **DEV** badge in the corner of each screen marks the test environment.

The purchase followed most closely is **ten ergonomic office chairs for the ICT department**. Other sample purchases (laptops, monitors, servers, tool kits) appear where they show a stage the chairs had already passed.

### Who uses the system

| Role | What they do |
| --- | --- |
| End user (requester) | Asks for goods or services by raising a requisition |
| Department head | Approves their department's requisitions |
| Stores officer | Checks whether stock is already held, receives deliveries, manages inventory |
| Procurement officer (buyer) | Accepts requisitions, runs requests for quotation, raises purchase orders |
| Head of Procurement | Authorizes the chosen quotation and approves purchase orders |
| Finance | Approves purchase orders against budget, matches invoices, pays suppliers |
| COO | Authorizes purchase orders of USD 5,000 or more |
| Supplier | Quotes, acknowledges orders, invoices and keeps their company profile up to date |
| Administrator | Manages users, departments and sites, and reviews the audit trail |

### The cycle at a glance

1. A staff member raises a **requisition**.
2. Their **department head** approves it.
3. **Stores** checks whether the item is already in stock.
4. **Procurement** accepts it and sends a **request for quotation (RFQ)** to suppliers.
5. **Suppliers** submit sealed quotations.
6. Procurement **ranks the bids and selects a winner**, and the Head of Procurement **authorizes** the choice.
7. A **purchase order (PO)** is raised and approved by the Head of Procurement, Finance and, at USD 5,000 or more, the COO.
8. The **supplier acknowledges** the order, which issues it.
9. **Stores receives the goods** and records a goods received voucher (GRV).
10. The supplier **invoices**, and the system runs a **three-way match** of order, delivery and invoice.
11. **Finance approves and pays** the invoice.

Throughout, the system sends **notifications**, records an **audit trail** of every action, and guards supplier **bank details** against fraud.

---

# Part 1 — Getting into the system

## Step 1. Sign in

![The sign-in page. The business unit is chosen first, then email and password.](screens/01-login.jpg)

Everyone, staff and suppliers alike, signs in on the same page. The person first picks their **business unit**, because each unit's data is kept separately. They then enter their email and password. In the live system, a one-time code is then emailed to them, and they must enter it to finish signing in (two-factor sign-in).

Suppliers who are not yet registered follow **Register your company**.

## Step 2. A supplier registers

![Supplier self-registration, in four short steps: account, company, address and banking.](screens/02-register-supplier.jpg)

A new supplier registers in four steps: their account, company details, address and banking details. The supplier cannot trade straight away. Procurement first reviews the application, checks the supplier's documents (Know Your Supplier, or KYS) and approves them. Only approved suppliers can be invited to quote.

---

# Part 2 — Setting the system up

These are one-time and occasional tasks for the administrator.

## Step 3. The administrator's dashboard

![The administrator's dashboard: users, suppliers awaiting review, open RFQs and purchase orders awaiting approval.](screens/03-admin-dashboard.jpg)

Each role lands on a dashboard showing what needs their attention. The administrator sees the whole unit: user numbers, suppliers waiting for review, quotations and purchase orders in progress, low stock, and failed sign-ins.

## Step 4. Staff accounts and roles

![Staff Team: every account with its role, department and status.](screens/04-admin-users.jpg)

The administrator creates each staff account and gives it a **role**. The role decides exactly what that person can see and do. A requester cannot approve, a buyer cannot pay, and finance cannot change a supplier's bank account.

## Step 5. Departments

![Departments, each with its head. The head is the person who approves that department's requisitions.](screens/05-admin-departments.jpg)

Each department has a head. When someone in a department raises a requisition, it goes to that department's head for approval.

## Step 6. Sites and stores

![Sites: the head office and yard stores where goods are delivered and held.](screens/06-admin-sites.jpg)

Sites are the physical places where goods are delivered and stock is held. Every delivery and every stock movement is recorded against a site.

---

# Part 3 — The supplier base

## Step 7. The supplier list

![All suppliers, with their trading status and KYS verification.](screens/07-suppliers.jpg)

Procurement sees every supplier with two separate statuses. The **vendor status** says whether the supplier may trade (pending, active, suspended or blacklisted). The **KYS status** says whether their documents have been verified. Suppliers can be added one at a time or imported in bulk.

## Step 8. A supplier's record

![TechZone Hardware's record: company details, KYS status, documents, banking, directors, references and performance.](screens/08-supplier-details.jpg)

Each supplier has a full record, split into tabs: company details, banking, trade categories, directors, client references, documents, vetting and performance evaluations. The **categories** decide which RFQs a supplier is matched to, so the system can suggest suppliers automatically.

---

# Part 4 — Raising a requisition

## Step 9. The requester's dashboard

![The end user's dashboard: their requisitions by stage.](screens/10-requester-dashboard.jpg)

An end user sees only their own requisitions, grouped by where each one has reached.

## Step 10. Creating a requisition

![The internal requisition form: title, description, work order, urgency and the items needed.](screens/11-create-requisition.jpg)

The requester describes what they need, gives a work order or project reference, and adds each item with its quantity and an estimated price. While typing, they can search the **stock catalogue**, so items the business already holds are picked from inventory rather than bought again.

## Step 11. Tracking requisitions

![My Requisitions: every request with its status, and the purchase order it became.](screens/12-requisitions-requester.jpg)

The requester can follow each request all the way through. The office chairs requisition (PR-2026-00021) is shown as ordered on purchase order DOKUMA-PO-2026-00003, and **delivered to stores**.

## Step 12. A draft requisition

![A requisition saved as a draft, waiting for the requester to submit it.](screens/13-requisition-draft.jpg)

A requisition can be saved as a draft and finished later. Nothing happens to it until the requester presses **Submit**. It then goes to their department head.

---

# Part 5 — Department head approval

## Step 13. The head's queue

![The Head of Operations' list, with a requisition awaiting their approval and approve and reject buttons.](screens/14-hod-approvals.jpg)

The department head sees the requisitions from their own department that are waiting for them. They can approve or reject each one directly from the list.

## Step 14. Reviewing the requisition

![The requisition the head is reviewing: justification, line items, who asked and its status history.](screens/15-requisition-awaiting-hod.jpg)

Before deciding, the head can open the requisition to see the justification, the items and who asked. They can also take out any line they do not want bought. A head cannot approve a requisition they raised themselves. Every step is added to the **status history**.

---

# Part 6 — The stores check

## Step 15. Is it already in stock?

![Stores review: each requested item with the quantity on hand, and options to issue from stock or forward to procurement.](screens/16-stores-pr-review.jpg)

Once approved, the requisition goes to **stores** before anything is bought. The stores officer sees how much of each item is already held. If it is in stock, they issue it and nothing is purchased. If it is not, they **forward it to procurement**. This stops the business buying what it already has.

---

# Part 7 — Procurement takes it on

## Step 16. The procurement officer's dashboard

![The procurement officer's dashboard: open RFQs, quotations, active suppliers and purchase orders.](screens/18-buyer-dashboard.jpg)

## Step 17. Accepting requisitions

![Purchase Requisitions as procurement sees them: waiting to be accepted, in sourcing, quoted and ordered.](screens/17-procurement-requisitions.jpg)

The procurement officer accepts each forwarded requisition. From then on they can follow it through sourcing, quotation and ordering.

---

# Part 8 — Request for quotation

## Step 18. Creating the RFQ

![Create RFQ: title, requirements, submission deadline and delivery date. The items come straight from the requisition.](screens/19-create-rfq.jpg)

The buyer creates a request for quotation from the accepted requisition. The **items are locked** to what was approved, so the buyer cannot add to or change them. The buyer sets a submission deadline and chooses suppliers. The system suggests suppliers whose categories match the items.

## Step 19. All RFQs

![RFQs by stage: open, evaluating and awarded, with the suppliers invited to each.](screens/20-rfqs.jpg)

## Step 20. An open RFQ: bids are sealed

![An open RFQ. A notice explains that bids are sealed until the deadline passes or the RFQ is closed.](screens/21-rfq-open.jpg)

While an RFQ is open, **no one can see the prices quoted**, not even procurement. Bids are revealed only when the deadline passes or the buyer closes the RFQ. This protects the competition and stops anyone from tipping off a favoured supplier.

The procedure calls for **at least three quotations**. Going ahead with fewer needs a recorded waiver approved by the COO or the Head of Procurement.

---

# Part 9 — Suppliers quote

## Step 21. The supplier's dashboard

![TechZone's dashboard: RFQs, quotations, purchase orders, invoices and KYS documents.](screens/22-supplier-dashboard.jpg)

Suppliers use the same system, but see only their own business with the unit.

## Step 22. RFQs the supplier is invited to

![My RFQs: each invitation with its closing time and status, and a Submit Quote button on the open one.](screens/23-supplier-my-rfqs.jpg)

## Step 23. Submitting a quotation

![The open RFQ from the supplier's side, with the items required and the Submit Quote button.](screens/24-supplier-rfq-quote.jpg)

The supplier quotes a price for each line, their delivery period, payment terms and how long the quote is valid.

---

# Part 10 — Evaluating and awarding

## Step 24. Ranking the responses

![The Workstations RFQ after closing: responses ranked by weighted score, with price, delivery and evaluation history.](screens/25-rfq-quotes-in.jpg)

Once bids are revealed, the system **ranks them**, weighing price, delivery time and the supplier's past performance. It labels the lowest price and the fastest delivery, and explains its recommendation in plain words. The ranking is **advice**: the buyer still chooses, and must write down why.

## Step 25. Splitting the award line by line

![Split award: each line can go to a different supplier, with the recommended price highlighted.](screens/26-award-matrix.jpg)

When an RFQ has several lines, each line can be awarded to a different supplier. Each line is authorized separately, and a purchase order is raised for each winning supplier.

## Step 26. All quotations

![Every quotation received, with its RFQ, supplier, amount, validity and status.](screens/27-quotations.jpg)

## Step 27. The award for the office chairs

![The office chairs RFQ awarded. CodeBridge scored highest on the weighted ranking; TechZone had the lowest price.](screens/29-rfq-awarded.jpg)

This screen shows the ranking at work. CodeBridge Solutions scored highest overall because it would deliver three days sooner, but TechZone quoted the lowest price. The buyer chose **TechZone**, with the written reason *"lowest price, compliant, acceptable delivery"*. The **Head of Procurement** then authorized that choice, so no single person decides an award alone.

---

# Part 11 — The purchase order and its approvals

## Step 28. Purchase orders

![Purchase orders by stage: draft, awaiting each approval, approved, issued and completed.](screens/30-purchase-orders.jpg)

The buyer raises a purchase order from the accepted quotation, and the supplier, items and prices carry across automatically. The PO then passes through its approval chain.

## Step 29. The approval chain

![A PO awaiting Finance. Approval Status shows each step: Procurement HOD approved, Finance pending, COO authorization required.](screens/31-po-awaiting-finance.jpg)

Every purchase order is approved in this order:

1. **Head of Procurement**
2. **Finance**, which checks it against the department's budget
3. **COO**, only for orders of **USD 5,000 or more**

The screen shows each step, who approved it and when. This order is for USD 8,050, so it needs the COO as well. Each step belongs to a different role, so no single person can carry an order through on their own. The auditor's evidence pack flags any order where one person acted at two steps, or approved an order they raised.

## Step 30. Finance's approval queue

![Finance Approval: purchase orders waiting for Finance, with their value.](screens/32-finance-approvals.jpg)

## Step 31. The COO

![The COO's dashboard: approvals pending and their value.](screens/33-coo-dashboard.jpg)

![COO Authorization: orders at or above the COO limit.](screens/34-coo-approvals.jpg)

![A USD 7,245 purchase order awaiting COO authorization, with the Head of Procurement and Finance steps complete.](screens/35-po-awaiting-coo.jpg)

The COO sees only orders at or above the threshold, with every earlier approval shown, so they authorize knowing who has already checked the order.

---

# Part 12 — The order goes to the supplier

## Step 32. The supplier acknowledges

![The supplier's purchase orders, with the office chairs order acknowledged.](screens/36-supplier-purchase-orders.jpg)

Once fully approved, the order appears in the supplier's portal. When the supplier **acknowledges** it, confirming they will deliver, the order is formally **issued**.

## Step 33. The completed order

![The office chairs PO, completed: Procurement HOD and Finance approved, and COO not required because the order is under USD 5,000.](screens/37-po-issued-history.jpg)

The office chairs order is USD 2,070 including VAT, under the COO limit, so it needed only the Head of Procurement and Finance. The system records why the COO step was skipped. A formal PO document can be printed or sent to the supplier at any point.

---

# Part 13 — Receiving the goods

## Step 34. Goods received voucher (GRV)

![Goods Receiving: each delivery with its GRV number, PO, supplier, delivery note and status.](screens/38-deliveries-grv.jpg)

When the chairs arrive, the stores officer records a **goods received voucher** against the purchase order. It records:

- the quantity received and its condition
- the supplier's delivery note number
- who delivered
- who from the department inspected the goods

Damaged or faulty items are recorded as rejected and are not added to stock. Each GRV can be printed for signing.

## Step 35. Stock updates automatically

![Inventory: every item with its stock level, reorder level, unit price and status. The ergonomic office chairs now show 10 in stock.](screens/39-inventory.jpg)

Goods received in good condition go straight into **inventory** at the receiving site. Items below their reorder level are flagged, so stores knows what to request next.

![Stock Movements: the +10 office chairs received under GRV DOKUMA-GRV-2026-00002.](screens/40-stock-movements.jpg)

Every movement of stock in or out is recorded, with its reference document and who made it.

![The stores officer's dashboard: inventory value, items needing reorder, deliveries received this month.](screens/56-stores-dashboard.jpg)

---

# Part 14 — The invoice and the three-way match

## Step 36. The supplier submits an invoice

![The supplier's invoice form: choose the purchase order, enter the invoice number and date, and submit for three-way match.](screens/42-submit-invoice.jpg)

The supplier invoices against the purchase order from their portal. When they submit, the system immediately runs a **three-way match**, comparing three things:

- what was **ordered** (the PO)
- what was **received** (the GRV)
- what is **invoiced**

## Step 37. A mismatch is caught

![Three-way match failed: the invoice omits the USD 270 VAT on the purchase order. Finance can reject it, or approve only with a written reason.](screens/44-invoice-variance.jpg)

In this walkthrough, the supplier's first invoice left out the 15% VAT on the purchase order. The system flagged it as a **variance** and showed exactly what does not agree. Finance cannot simply approve such an invoice: they must either reject it, or approve it with a written reason that is kept on the record.

Here Finance **rejected** it, asking for the VAT to be included.

## Step 38. The corrected invoice matches

![The corrected invoice: the three-way match passes, linked to its PO and GRV.](screens/51-invoice-matched-paid.jpg)

The supplier resubmitted the invoice with VAT. This time the order, the goods received and the invoice agree, and the match passes.

![Invoices as Finance sees them: the rejected first invoice, and the corrected one, now paid.](screens/43-finance-invoices.jpg)

![The same history from the supplier's side.](screens/41-supplier-invoices.jpg)

---

# Part 15 — Paying the supplier

## Step 39. Payment

![Payments: each payment with its supplier, amount and date. A banner shows the next payment run.](screens/52-payments.jpg)

Finance pays approved invoices. Payments are made in the scheduled runs (Tuesdays and Thursdays). Each payment records the **bank account it was paid to** at that moment, so the account used for any historical payment can always be traced, even if the supplier changes banks later.

## Step 40. Finance's view

![The Finance dashboard: approvals pending, approved POs, and PO value.](screens/55-finance-dashboard.jpg)

## Step 41. Budgets

![Budget Management: each department's allocation, what it has spent, what is committed on open orders, and what remains.](screens/47-budgets.jpg)

Each department has a yearly budget. The system tracks, live:

- **Utilized:** what has been paid.
- **Committed:** what is promised on approved but unpaid orders.
- **Available:** what is left.

Finance sees this before approving each purchase order.

---

# Part 16 — Protecting supplier bank details

Changing a supplier's bank account is the most common way payments are stolen. A fraudster poses as the supplier, or an insider changes the account, and the next payment goes to the wrong place. The system therefore never lets a bank account be changed in one step.

## Step 42. A supplier asks to change banks

![NetLink Telecom's profile in the supplier portal. Banking details can be edited, but a change does not take effect immediately.](screens/45-supplier-profile-banking.jpg)

When a supplier, or a member of staff, edits the banking details, the change is held as a **request**. It is not applied to the record. **All payments to that supplier stop automatically** until the request is resolved, so pressure to "pay urgently" cannot get around the check.

## Step 43. Verification by callback

![The request awaiting verification: each changed field shown from old to new, and payments on hold.](screens/46-bank-changes-pending.jpg)

Procurement must phone the supplier on a number **already on file**, never one given in the request, to confirm the change is genuine. The system refuses a callback to an unknown number, because that would reach whoever sent the request.

## Step 44. Approval by a second person

![The callback recorded (who called, which number, who confirmed it). The request now waits for a second person to approve.](screens/53-bank-change-awaiting-approval.jpg)

After the callback, a **different person** must approve the change. The system will not accept approval from the person who raised the request or the person who made the call. Only after approval does the new account take effect and payments resume.

Elsewhere in the system, account numbers are shown only as their last four digits, except where money is actually paid or a change is being verified.

---

# Part 17 — Oversight

## Step 45. Reports

![Reports and analytics: procurement activity, supplier performance, RFQ statistics and spend trend.](screens/48-reports.jpg)

Each role gets reports suited to its work: spend trends, RFQ outcomes, supplier performance and purchase order summaries. Reports can be exported.

## Step 46. Notifications

![Notifications for Finance, including a banking change request and an invoice with a variance.](screens/49-notifications.jpg)

People are told when something needs them, both in the system and by email. Examples include a requisition to approve, a quotation received, an invoice variance or a bank change request.

## Step 47. The audit trail and the auditor's evidence pack

![Audit Logs: every action, with who did it, when, from where and what changed. The Evidence pack button is at the top right.](screens/54-audit-logs-after.jpg)

Every significant action is recorded: sign-ins, approvals, rejections, edits, deliveries, payments and bank changes. Each entry shows who did it, when, from which address, and exactly which fields changed. The trail can be searched, filtered and exported.

The **Evidence pack** button produces, for any period, one file an auditor can use to test the controls. It covers:

- who has access, including dormant accounts and active administrators
- every bank change, with its callback and independent approver
- every payment, flagging any made shortly after a bank change
- every purchase order's approval chain, flagging missing approvals or the same person at two steps
- every three-quote waiver, with its reason

Each section lists its exceptions separately, so a clean period shows empty lists.

---

# Summary — the controls the system enforces

| Risk | Control in the system |
| --- | --- |
| Buying what is already in stock | Stores checks every approved requisition before procurement sources it |
| Requests changed after approval | RFQ items are locked to the approved requisition |
| Favouritism in quoting | Bids are sealed until the deadline; at least three quotations or a recorded waiver |
| One person deciding an award | Buyer selects with a written reason; the Head of Procurement authorizes |
| Unapproved or oversized spending | PO approval by the Head of Procurement and Finance, and by the COO at USD 5,000 or more; budget checked live |
| Approving your own work | A head cannot approve a requisition they raised; each PO step needs a different role, and the evidence pack flags any overlap |
| Paying for goods not received, or the wrong amount | Three-way match of order, delivery and invoice; variances need rejection or a written reason |
| Payment redirection fraud | Bank changes held, payments paused, callback to a known number, approval by a second person |
| Untraceable actions | Full audit trail and an auditor's evidence pack |
| Data mixing between business units | Each business unit's data is held separately; users choose their unit at sign-in |
