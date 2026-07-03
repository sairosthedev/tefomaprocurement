# Tefoma Procurement — What This System Does

**Product name:** Tefoma Procurement (Tefoma Construction)  
**Live application:** https://fossilprocure.vercel.app  
**Audience:** Business users, management, and UAT testers  

This document explains **what the system is for**, **who uses it**, and **how the main processes work** — without technical detail.

---

## 1. Purpose

Tefoma Procurement is a **web-based procurement and stores management system**. It replaces paper and email chains with one place to:

- Request goods and services (internal requisitions)
- Source suppliers and collect quotations
- Approve and issue purchase orders
- Receive goods into stores and track inventory
- Manage supplier compliance (KYS) and performance
- Pay suppliers (invoices and payments)
- Report on spend, suppliers, and activity

Everything is **role-based**: each person sees only what they need. Actions are **logged** for audit.

---

## 2. Who uses the system

| Role | Main job in the system |
|------|------------------------|
| **Admin** | Users, departments, sites, suppliers, audit logs, full oversight |
| **End user** | Creates purchase requisitions for their department |
| **Department head** | Approves requisitions and purchase orders for their department |
| **Stores officer** | Reviews stock for requisitions, receives deliveries (GRV), manages inventory, store requisitions, stock transfers |
| **Procurement officer** | Suppliers, KYS, RFQs, quotations, purchase orders, evaluations |
| **Finance** | Budgets, PO approval, invoices, payments |
| **COO** | High-value PO approval (typically ≥ USD 5,000), reports, supplier oversight |
| **Supplier** (external) | Profile, KYS documents, RFQs, quotations, POs, deliveries, invoices |

Staff sign in at `/login`. Suppliers use `/supplier/login` or self-register at `/register`.

**Security:** Sign-in uses email, password, and a **one-time code (OTP)** sent to the user’s inbox.

---

## 3. The big picture — one procurement journey

```
End user creates requisition
        ↓
Department head approves
        ↓
Stores checks stock → issue from stock OR forward to procurement
        ↓
Procurement accepts requisition → creates RFQ → invites suppliers
        ↓
Suppliers submit quotations
        ↓
Procurement selects quotation → creates purchase order
        ↓
Approvals: Department head → Finance → COO (if amount threshold met)
        ↓
Supplier acknowledges PO → delivers goods
        ↓
Stores receives goods (GRV) → stock updated
        ↓
Supplier submits invoice → Finance approves and records payment
```

Not every requisition goes through every step (e.g. items fully issued from stock skip procurement).

---

## 4. Modules and what they do

### 4.1 Organisation setup (Admin)

- **Staff Team** — Create users, assign roles, departments, sites.
- **Departments** — Organisational units for requisitions and budgets.
- **Sites** — Locations (e.g. Head Office) for inventory and stock transfers.

### 4.2 Purchase requisitions (Internal requests)

**Who:** End users create; department heads approve; stores review.

- **My Requisitions** — Draft and submit requests with line items (from catalog or free text).
- **Approvals** — Department head approves or rejects with a reason.
- **Stores PR Review** — Stores checks whether items are in stock, issues stock, fulfills, or forwards to procurement.

**Statuses** move from draft → pending approval → stores review → fulfilled or forwarded → procurement sourcing.

### 4.3 Procurement sourcing

**Who:** Procurement officers (and procurement head where configured).

- **Requisitions** — Accept or reject items forwarded from stores; adjust lines before accepting.
- **RFQs** — Create from requisitions, invite **active** suppliers, set deadline, publish and close.
- **Quotations** — Review supplier quotes; accept, reject, or use a waiver when fewer than three quotes.
- **Purchase Orders** — Create from winning quotation; submit into the approval chain.

### 4.4 Purchase order approvals

**Who:** Department head, Finance, COO (for larger values).

- **Approvals** — Each role sees POs waiting for them; approve or reject with comments.
- Typical chain: **HOD → Finance → COO** (COO when total meets the configured threshold, e.g. USD 5,000).

### 4.5 Supplier management

**Who:** Procurement and Admin.

- **Suppliers** — List, add, bulk import, filter by status (pending, active, etc.).
- **Supplier profile** — Tabs for overview, corporate, banking, trade, directors, references, documents, performance, reports. Procurement can **Edit** each section and save.
- **KYS (Know Your Supplier)** — On the **Documents** tab: upload compliance files, complete checklist, **Verify KYS & Activate** (or override with reason). Pending suppliers are found under **Suppliers → Pending**.
- **Evaluations** — Procurement scores suppliers on 7 criteria (1–5); saved **immediately** (no approval workflow). Drives performance analytics and supplier profile scores.
- **Analytics → Performance** — Rankings and scores from evaluations (out of 5).
- **Analytics → Compliance** — KYS verified vs pending, document coverage, watchlist.
- **Evaluations** (menu) — Due suppliers, record new evaluations, history.

### 4.6 Supplier portal

**Who:** Registered suppliers.

- Complete **profile** and **KYS documents**.
- **My RFQs** — View invites and submit quotations.
- **My Purchase Orders** — Acknowledge and track orders.
- **My Deliveries** — Delivery status.
- **Submit Invoice** — Invoices linked to POs.

New suppliers may **self-register**; procurement verifies KYS and activates them.

### 4.7 Stores and inventory

**Who:** Stores officers.

- **Inventory** — Catalog items, quantities, reorder levels.
- **Deliveries (GRV)** — Receive against POs; accept into stock (full, partial, or reject).
- **Store Requisitions** — Departments request stock from stores.
- **Stock Movements** — History of ins and outs.
- **Stock Transfers** — Move stock between sites.

### 4.8 Finance

**Who:** Finance role.

- **Budgets** — Department allocations.
- **Invoices** — Review supplier invoices; approve or reject.
- **Payments** — Record payments against approved invoices.
- **Approvals** — Financial step on purchase orders.

### 4.9 Reports and oversight

- **Reports** — Role-based dashboards; **Suppliers** tab for registry, spend, scores, export.
- **Audit Logs** (Admin) — Who did what and when.
- **Notifications** — In-app alerts for workflow events (RFQ published, PO approved, etc.).
- **Email** — OTP, password reset, and workflow emails when configured on the server.

---

## 5. Supplier compliance (KYS) in plain terms

Before a supplier is **active** and can quote on RFQs:

1. Supplier profile is created (by procurement or self-registration).
2. Compliance documents are uploaded (tax clearance, registration, etc.).
3. Procurement completes the **KYS checklist** on the supplier **Documents** tab.
4. Procurement clicks **Verify KYS & Activate** (or uses a documented override).

**Compliance** analytics show who is verified, who is pending, and checklist progress (%).

---

## 6. Supplier performance (evaluations) in plain terms

Procurement periodically **evaluates** suppliers:

- Seven areas scored 1–5 (e.g. pricing, delivery, quality).
- **Overall score** = average of those scores (out of **5**, not a percentage).
- Evaluations are **saved when submitted** — no HOD or COO sign-off on evaluations.
- **Next review** is typically set **3 months** ahead.
- **Performance** page and supplier profile **Performance** tab show the latest scores.

---

## 7. Notifications and email

| Channel | What it covers |
|---------|----------------|
| **In-app notifications** | RFQs, approvals, PO status, supplier events, etc. |
| **Email** | Login OTP, password reset, and workflow emails (when API email is configured) |

Branding in emails and the app uses **Tefoma Construction / Tefoma Procurement**.

---

## 8. What the system does *not* do (today)

- It is **not** a full accounting/ERP system — it tracks procurement and payments but does not replace your ledger.
- **Evaluation scores** are manual ratings, not auto-calculated from delivery or invoice data.
- Some analytics pages only show meaningful data **after** suppliers exist, KYS is done, and/or evaluations are recorded.

---

## 9. Related documents

| Document | Use for |
|----------|---------|
| [CLIENT_TESTING_GUIDE.md](./CLIENT_TESTING_GUIDE.md) | Step-by-step UAT on the live site |
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Developer / internal testing notes |
| [BUSINESS_README.md](./BUSINESS_README.md) | Broader business case and feature list (may include older naming) |

---

## 10. Quick reference — menu by role

**Admin:** Dashboard, Staff, Departments, Sites, Suppliers (list, analytics, evaluations), RFQs, Quotations, POs, Reports, Audit logs.

**Procurement:** Requisitions, RFQs, Quotations, POs, Suppliers, Reports.

**Department head:** Approvals, My Requisitions, Store Requisitions, Reports.

**Stores:** PR review, Deliveries, Inventory, Store Requisitions, Stock movements/transfers, Reports.

**Finance:** Approvals, Invoices, Payments, Budgets, POs, Reports.

**COO:** Approvals, Reports, Suppliers (read/evaluate oversight).

**Supplier:** Dashboard, RFQs, Quotations, POs, Deliveries, Profile, KYS, Invoices.

---

*Last updated to reflect current application behaviour: consolidated supplier workflow, immediate evaluations, and Tefoma branding.*
