# fossilProcure Testing Guide

This guide is for normal users, not developers. Follow the steps in order so you can test the full business process from request to payment.

## 1. What testers need

- A browser and the test system link.
- One login for each role you want to test.
- A supplier account for the supplier steps.
- **Setup time:** allow 30–60 minutes before the first full E2E run to create inventory items and (optionally) a second site for stock transfers.

If you do not already have all the logins, ask the project owner for them before testing.

## 2. Developer setup (for the team hosting QA)

1. Copy `api/.env.example` → `api/.env` and set `MONGODB_URI` and `JWT_SECRET`.
2. Copy `client/.env.example` → `client/.env` and set `VITE_API_URL=http://localhost:3001/api` for local testing.
3. Run `npm install` then `npm run dev`.
4. Seed test accounts: **`npm run seed:all`** (creates all staff roles + 6 active suppliers).
5. Optional email: set `RESEND_API_KEY`, `EMAIL_FROM`, and `CLIENT_URL` in `api/.env`.

## 3. Login pages and accounts

- Staff/admin login page: `/login`
- Supplier login page: `/supplier/login`
- Supplier registration page: `/register`

### Seeded accounts (`npm run seed:all`) — password **`Admin@123`** for all:

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
| ict.*@techzone.co.zw (6 suppliers) | Active supplier accounts |

### Login OTP

Every login requires a one-time code (OTP). If email is not configured, the OTP appears in the **API server console** and (by default) in the browser developer tools network response. In-app notifications work without email.

## 4. Pre-test setup (stores)

Before Step 3 below, the stores officer should:

1. Open **Inventory** and add catalog items that match what end users will request.
2. Set quantities on hand for those items.
3. (Optional) Admin → **Sites**: add a second site if testing stock transfers.

## 5. Full end-to-end test flow

Use one test request and move it through every role below.

### Step 1: End user creates a requisition

1. Log in as an end user (`james@fossilzim.com`).
2. Open Requisitions → Create Requisition.
3. Search the stock catalog for items (or type a description manually).
4. Select a category for each line, quantity, and submit.

Expected result: the requisition is saved with pending status.

### Step 2: Department head reviews the request

1. Log in as a department head (`mac@fossilzim.com`).
2. Open Approvals or Requisitions.
3. Approve or reject with a reason.

Expected result: status updates and the requester is notified.

### Step 3: Stores reviews the approved request

1. Log in as stores officer (`alfred@fossilzim.com`).
2. Open **Stores PR Review**.
3. Use **Search inventory** to issue stock line-by-line, or **Auto-process stock** to issue available quantities automatically.
4. If all lines are issued: click **Fulfill from stock**.
5. If items are not in stock: click **Forward to procurement**.

Expected result: inventory updates when stock is issued; requisition moves to fulfilled or procurement queue.

### Step 4: Procurement creates the RFQ

1. Log in as procurement (`macdonald@fossilzim.com`).
2. Open RFQs → create from the approved/forwarded requisition.
3. Invite active suppliers and publish.

Expected result: suppliers see the RFQ in **My RFQs** (notification links open the RFQ detail page).

### Step 5: Supplier submits a quotation

1. Log in as a supplier (`ict.admin@techzone.co.zw` or similar).
2. Open My RFQs → open the RFQ → Submit Quote.
3. Confirm in My Submitted Quotations.

### Step 6: Procurement selects the quotation

1. Log in as procurement.
2. Open Quotations → review → select winner (3-quote waiver if needed).

Department heads use **Approvals** for PO-related steps; the Quotations list is for procurement officers.

### Step 7: Purchase order approvals

1. Procurement submits the PO.
2. HOD approves in **Approvals**.
3. Finance approves in **Approvals**.
4. If total ≥ USD 5,000, COO must also approve (or reject with reason).

Expected result: PO reaches approved status; supplier can acknowledge.

### Step 8: Supplier acknowledges PO

1. Supplier → My Purchase Orders → acknowledge with delivery note if prompted.

### Step 9: Goods received and accepted

1. Stores officer → **Deliveries**.
2. **Receive** goods against the PO (GRV).
3. Open the delivery → **Accept into stock** (accept, partial, or reject).

Expected result: delivery status updates and inventory increases on acceptance.

### Step 10: Supplier invoice and finance payment

1. Supplier submits invoice against the PO.
2. Finance → Invoices → approve.
3. Open invoice detail → record payment.

### Step 11: Notifications and audit

1. Check **Notifications** after major actions.
2. Admin → **Audit Logs** for a full trail.

## 6. What testers should report back

- The role they used.
- The exact step where the process stopped.
- A screenshot or short video if possible.
- The error message or unexpected screen.
- Whether the problem is a failed action, missing permission, or confusing wording.

## 7. Quick test checklist

1. End user creates a requisition (with catalog search).
2. Department head approves it.
3. Stores issues stock or forwards to procurement.
4. Procurement creates RFQ; supplier submits quote.
5. PO approved through HOD → Finance → COO (if ≥ $5,000).
6. Delivery received and accepted into stock.
7. Invoice approved and payment recorded.
