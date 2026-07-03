# Tefoma Procurement — Client Testing Guide

This guide is for **business testers** using the **live system**. You do not need access to the code or database.

**Live application:** [https://fossilprocure.vercel.app](https://fossilprocure.vercel.app)

---

## 1. Before you start

### What you need

- A modern web browser (Chrome, Edge, or Firefox).
- **Real email addresses** that can receive mail (see section 2).
- Your **admin login** (provided separately by your project contact).
- About **2–3 hours** for first-time setup, then **1–2 hours** for one full end-to-end test.

### Important rules

1. **Use only working email addresses** — every login sends a **one-time code (OTP)** to the user’s inbox. Fake or shared inboxes that nobody checks will block testing.
2. **Use one browser profile per role** when testing in parallel, or log out fully between roles.
3. **Follow the steps in order** the first time; later you can repeat individual sections.
4. **Take screenshots** of any error or unexpected screen when reporting issues.

---

## 2. Email addresses (critical)

The system sends:

- **Login OTP** — required on every sign-in (staff and suppliers).
- **Password reset** — if you use “Forgot password”.
- **Workflow notifications** — RFQ invites, approvals, etc. (in-app notifications always work; email depends on server configuration).

### Do

- Use addresses your team **owns and can open** (e.g. `jane.doe@yourcompany.co.zw`).
- Use **unique emails per test user** (one person = one email = one account).
- For suppliers, use a **real company contact email** or a dedicated test mailbox (e.g. `supplier-test@yourcompany.co.zw`).

### Do not

- Use `test@test.com`, `user@example.com`, or emails that **bounce**.
- Reuse the same email for **staff and supplier** accounts.
- Use emails you **cannot access** — you will not receive the OTP.

### Suggested naming (optional)

| Role | Example email pattern |
|------|------------------------|
| End user | `requester@yourcompany.co.zw` |
| Department head | `hod.ict@yourcompany.co.zw` |
| Stores | `stores@yourcompany.co.zw` |
| Procurement | `procurement@yourcompany.co.zw` |
| Finance | `finance@yourcompany.co.zw` |
| COO | `coo@yourcompany.co.zw` |
| Supplier A | `supplier.a@partner.co.zw` |
| Supplier B | `supplier.b@partner.co.zw` |
| Supplier C | `supplier.c@partner.co.zw` |

Keep a simple spreadsheet: **Name | Email | Role | Password (shared securely)**.

---

## 3. How to sign in

| Who | Login page |
|-----|------------|
| **Staff** (admin, procurement, finance, stores, etc.) | [https://fossilprocure.vercel.app/login](https://fossilprocure.vercel.app/login) |
| **Suppliers** | [https://fossilprocure.vercel.app/supplier/login](https://fossilprocure.vercel.app/supplier/login) |
| **New supplier self-registration** | [https://fossilprocure.vercel.app/register](https://fossilprocure.vercel.app/register) |

### Login steps (all users)

1. Enter **email** and **password**.
2. Click **Sign in**.
3. Check the **email inbox** (and spam folder) for a **6-digit OTP**.
4. Enter the OTP on screen and complete sign-in.

If OTP does not arrive within 2 minutes, confirm the email is correct and real, then try again or contact your administrator.

---

## 4. Phase A — Admin setup (do this first)

Sign in as **admin** ([login](https://fossilprocure.vercel.app/login)).

### A1. Departments

1. Open **Departments** in the sidebar.
2. Create departments you will use in testing (e.g. **ICT**, **Operations**, **Finance**).
3. Note each department name — users must be assigned to a department where required.

### A2. Sites

1. Open **Sites**.
2. Confirm **Head Office (HQ)** exists.
3. Optionally add a second site (e.g. **Site B**) if you will test **stock transfers**.

### A3. Staff test users

1. Open **Staff Team** (Users).
2. Click **Add user** for each role below.
3. Use **real emails** and passwords (minimum 6 characters). Share passwords securely with testers.

| Role to select | Purpose in testing |
|----------------|-------------------|
| End user | Creates purchase requisitions |
| Department head | Approves requisitions and POs (assign **department**) |
| Stores officer | Reviews stock, receives goods (assign **home site**) |
| Procurement officer | RFQs, quotations, POs |
| Finance | PO and invoice approval, payments, budgets |
| COO | Approves POs **over USD 5,000** |

**Expected:** Each user appears in the list as **Active**. Each can log in and receive OTP at their email.

### A4. Inventory (for stores testing)

1. Log in as **stores officer** (or stay as admin if you have access to **Inventory**).
2. Open **Inventory** → add a few **catalog items** (e.g. paper, toner, cables).
3. Set **quantity on hand** and **reorder level** so stores can issue stock or show low-stock alerts.

### A5. Supplier accounts (need at least 3 for full quotation testing)

**Option 1 — Admin/procurement creates suppliers (recommended)**

1. As admin, open **Suppliers** → **Add supplier**.
2. Fill company details and use a **real supplier email**.
3. Set a temporary password; the supplier receives a welcome email if mail is configured.
4. Repeat for **at least three suppliers** if you want to test the “three quotations” rule without a waiver.

**Option 2 — Supplier self-registers**

1. Supplier opens [Register](https://fossilprocure.vercel.app/register) and completes KYS.
2. Procurement opens **Verification Hub** or **Suppliers** → opens the pending supplier → **Approve & Activate**.

**Expected:** Suppliers show status **Active** before they can be invited to RFQs.

### A6. Budgets (optional)

1. As **finance** or **admin**, open **Budgets**.
2. Set department allocations if you want to test budget views.

---

## 5. Phase B — Full procurement process (one test case)

Use **one requisition** and carry it through every step. Write down the **requisition number**, **RFQ number**, **PO number**, and **invoice number** as you go.

### Step 1 — End user: create internal requisition

**Login:** End user → [Staff login](https://fossilprocure.vercel.app/login)

1. **My Requisitions** → **Create Requisition**.
2. Enter title, work order (optional), and line items.
   - Prefer **searching the stock catalog** if items were added in inventory.
   - Select a **category** for each line.
3. **Submit for approval**.

**Expected:** Status **Pending** (awaiting department head).

---

### Step 2 — Department head: approve requisition

**Login:** Department head

1. **Approvals** or **My Requisitions** → open the requisition.
2. **Approve** (or reject with a reason to test rejection flow separately).

**Expected:** Status moves to **stores review** (or similar). Requester sees update in **Notifications**.

---

### Step 3 — Stores: stock check and issue

**Login:** Stores officer

1. **Stores PR Review** (internal requisitions queue).
2. For each line:
   - **Search inventory** → issue stock if available, **or**
   - **Auto-process stock** to issue what is on hand automatically.
3. If **all lines** are fully issued → **Fulfill from stock**.
4. If **not in stock** → **Forward to procurement**.

**Expected:** Inventory quantities decrease when stock is issued; otherwise requisition appears for procurement.

---

### Step 4 — Procurement: accept and create RFQ

**Login:** Procurement officer

1. **Requisitions** → find forwarded/accepted requisitions.
2. **Accept** for procurement processing if prompted.
3. **RFQs** → **Create RFQ** from the requisition.
4. Invite **active suppliers** (at least one; three if testing competitive quotes).
5. Set **submission deadline** and **publish** the RFQ.

**Expected:** Suppliers receive notification; RFQ appears in supplier **My RFQs**.

---

### Step 5 — Suppliers: submit quotations

**Login:** Each supplier → [Supplier login](https://fossilprocure.vercel.app/supplier/login)

1. **My RFQs** → open the RFQ → **Submit Quote**.
2. Enter prices, delivery terms, and submit.
3. Confirm under **My Submitted Quotations**.

**Expected:** Procurement sees quotations in **Quotations**.

*Repeat for 2–3 suppliers if testing selection among multiple quotes.*

---

### Step 6 — Procurement: select quotation and create PO

**Login:** Procurement officer

1. **Quotations** → open a quotation → review.
2. If fewer than three quotes, use **quotation waiver** with justification (if your process allows).
3. **Select** winning quotation and create **Purchase Order**.
4. Complete PO details and **submit** for approvals.

**Expected:** PO status **Pending approvals**.

---

### Step 7 — Approvals chain (HOD → Finance → COO if needed)

**Login:** Each approver in turn

| Approver | Where | Action |
|----------|--------|--------|
| Department head | **Approvals** | Approve or reject PO |
| Finance | **Approvals** | Approve or reject PO |
| COO | **Approvals** | Required only if PO total **≥ USD 5,000** |

**Expected:** PO becomes **Approved**. Supplier sees it under **My Purchase Orders**.

---

### Step 8 — Supplier: acknowledge purchase order

**Login:** Supplier

1. **My Purchase Orders** → open the PO.
2. **Acknowledge** and enter delivery note details if asked.

**Expected:** PO status updated; stores can receive goods.

---

### Step 9 — Stores: receive and accept goods (GRV)

**Login:** Stores officer

1. **Deliveries** → **Receive** against the PO (enter delivery note, quantities).
2. Open the delivery record → **Accept into stock** (accept, partial, or reject with notes).

**Expected:** GRV recorded; **Inventory** increases on acceptance.

---

### Step 10 — Supplier: submit invoice

**Login:** Supplier

1. **Submit Invoice** (or **My Invoices**) → link to the PO.
2. Enter invoice number, amount, and submit.

**Expected:** Invoice appears for finance.

---

### Step 11 — Finance: approve invoice and pay

**Login:** Finance

1. **Invoices** → open invoice → **Approve** (or reject with reason).
2. Open invoice detail → **Record payment**.

**Expected:** Payment recorded; process complete from request to payment.

---

### Step 12 — Verify audit trail

**Login:** Admin

1. **Notifications** — spot-check events across roles.
2. **Audit Logs** — confirm major actions were recorded.

---

## 6. Additional features to test (after main flow)

| Feature | Who | Where |
|---------|-----|--------|
| Store requisitions (issue from stores to staff) | End user / Stores | **Store Requisitions** |
| Stock transfers between sites | Stores / Admin | **Stock Transfers** + **Sites** |
| Supplier KYS & verification | Procurement / Admin | **Verification Hub**, **Suppliers** |
| Supplier evaluations | Procurement | **Suppliers → Evaluations** |
| Reports by role | Each role | **Reports** |
| Profile & password change | Any staff | **Profile** |
| Forgot password | Any user | Link on login page |
| Budgets | Finance / Admin | **Budgets** |

---

## 7. Quick checklist (printable)

- [ ] Admin created departments and sites  
- [ ] All test users created with **working emails**  
- [ ] Inventory items with stock on hand  
- [ ] At least one **active** supplier (three for full quote test)  
- [ ] End user submitted requisition  
- [ ] HOD approved requisition  
- [ ] Stores issued stock **or** forwarded to procurement  
- [ ] RFQ published and supplier(s) quoted  
- [ ] PO created and approved (HOD → Finance → COO if ≥ $5,000)  
- [ ] Supplier acknowledged PO  
- [ ] Goods received and accepted into stock  
- [ ] Invoice submitted, approved, and paid  
- [ ] Notifications and audit logs reviewed  

---

## 8. Reporting problems

When something fails, send:

1. **Date and time**
2. **URL** (e.g. `/app/requisitions`)
3. **Role and email** used (not the password)
4. **Step number** from this guide
5. **What you expected** vs **what happened**
6. **Screenshot** of the error or screen
7. **Requisition / RFQ / PO / Invoice number** if applicable

---

## 9. Admin accounts on live system

Your administrator will provide:

- **Admin email** (e.g. `kudzai@fossilzim.co.zw`)
- **Password** (shared securely, not in this document)

Use that account only for **setup** and **audit**; run the business process using the role accounts you create in **Staff Team**.

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| **IR / Requisition** | Internal request for goods or services |
| **RFQ** | Request for Quotation — sent to suppliers to bid |
| **PO** | Purchase Order — formal order after quote selection |
| **GRV** | Goods Received Voucher — proof goods were received |
| **KYS** | Know Your Supplier — compliance documentation |
| **OTP** | One-time password sent by email at login |
| **HOD** | Head of Department |

---

*Document version: for live testing on fossilProcureSystem-db / [fossilprocure.vercel.app](https://fossilprocure.vercel.app). Contact your project team for admin credentials or access issues.*
