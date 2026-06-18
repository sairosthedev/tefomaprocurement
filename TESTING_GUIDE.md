# fossilProcure Testing Guide

This guide is for normal users, not developers. Follow the steps in order so you can test the full business process from request to payment.

## 1. What testers need

- A browser and the test system link.
- One login for each role you want to test.
- A supplier account for the supplier steps.

If you do not already have all the logins, ask the project owner for them before testing.

## 2. Login pages and accounts

- Staff/admin login page: `/login`
- Supplier login page: `/supplier/login`
- Supplier registration page: `/register`
- Seeded staff/admin account: `admin@fossilzim.com` / `Admin@123`

Note: the repository seed only creates the staff/admin account. Supplier accounts must be created through the supplier registration page or provided by the team.

## 3. Full end-to-end test flow

Use one test request and move it through every role below.

### Step 1: End user creates a requisition

1. Log in as an end user.
2. Open Requisitions.
3. Select Create Requisition.
4. Fill in the item details, quantity, and reason for the request.
5. Submit the requisition.

Expected result: the requisition is saved and appears in the list with a pending status.

### Step 2: Department head reviews the request

1. Log out.
2. Log in as a department head.
3. Open Approvals or Requisitions.
4. Open the submitted requisition.
5. Approve it or reject it with a reason.

Expected result: the status changes correctly and the requester can see the update.

### Step 3: Stores reviews the approved request

1. Log out.
2. Log in as a stores officer.
3. Open Store Requisitions or Stores PR Review.
4. Check whether the item can be supplied from stock.
5. If stock is available, process it as a store issue.
6. If stock is not available, forward it for procurement.

Expected result: the request moves to the next correct stage and inventory is updated if stock is issued.

### Step 4: Procurement creates the RFQ

1. Log out.
2. Log in as a procurement officer.
3. Open RFQs.
4. Create a new RFQ from the approved request.
5. Select the supplier or suppliers to invite.
6. Save and publish the RFQ.

Expected result: the RFQ is created and the invited suppliers can see it in their portal.

### Step 5: Supplier registers or logs in

1. If the supplier does not yet have an account, go to `/register` and create one.
2. If the supplier already has an account, go to `/supplier/login`.
3. Log in as the supplier.
4. Open My RFQs.

Expected result: the supplier can see the RFQ that was sent to them.

### Step 6: Supplier submits a quotation

1. Open Submit Quotation.
2. Fill in the price, delivery time, and any other required details.
3. Submit the quotation.
4. Open My Submitted Quotations or My Quotations to confirm it was saved.

Expected result: the quotation appears in the supplier portal and is visible to procurement.

### Step 7: Procurement and department head review the quotation

1. Log out.
2. Log in as procurement officer or department head.
3. Open Quotations.
4. Open the quotation details.
5. Select the winning quotation or record the required approval decision.

Expected result: the winning quotation is recorded and the process can move to purchase order creation.

### Step 8: Purchase order is created and approved

1. Open Purchase Orders.
2. Create or review the purchase order for the selected quotation.
3. Follow the approval steps shown in the system.
4. If a higher approval is required, continue until it is fully approved.

Expected result: the purchase order reaches an approved status and the supplier can view it.

### Step 9: Supplier acknowledges the purchase order

1. Log in as the supplier.
2. Open My Purchase Orders.
3. Open the purchase order.
4. Acknowledge it if the action is available.

Expected result: the supplier can see the order and its status is updated.

### Step 10: Goods are delivered and received

1. Log out.
2. Log in as a stores officer.
3. Open Deliveries.
4. Record or review the delivery.
5. Confirm the goods received match the order.
6. Open Inventory or Stock Movements to confirm stock has changed.

Expected result: the delivery is recorded and inventory updates correctly.

### Step 11: Supplier submits an invoice

1. Log in as the supplier.
2. Open Submit Invoice or My Invoices.
3. Enter the invoice details against the purchase order.
4. Submit the invoice.

Expected result: the invoice is created and visible to finance.

### Step 12: Finance reviews and pays the invoice

1. Log out.
2. Log in as finance.
3. Open Invoices.
4. Review the invoice.
5. Approve or reject it.
6. If approved, open Payments and record the payment.

Expected result: the invoice moves through the finance process and the payment is recorded.

### Step 13: Check notifications and audit trail

1. Open Notifications after each major action.
2. Confirm the system shows the event.
3. If you are testing as admin, open Audit Logs and check that the action was recorded.

Expected result: the system keeps a clear record of what happened.

### Step 14: Log out and test access again

1. Log out of the account.
2. Try to open a protected page.
3. Confirm the system sends you back to login.

Expected result: protected pages are blocked after logout.

## 4. What testers should report back

- The role they used.
- The exact step where the process stopped.
- A screenshot or short video if possible.
- The error message or unexpected screen.
- Whether the problem is a failed action, missing permission, or confusing wording.

## 5. Quick test checklist

If you only have time for a short test, do these steps:

1. End user creates a requisition.
2. Department head approves it.
3. Stores reviews it.
4. Procurement creates the RFQ.
5. Supplier submits a quotation.
6. Purchase order is approved.
7. Delivery is received.
8. Finance approves and records payment.
