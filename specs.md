# Integrated Procurement & Stores Management System (iProcure-style)

**Client:** Fossil Contracting
**Platform:** MERN Stack (MongoDB, Express.js, React, Node.js)
**Document Type:** Full Functional & Technical Specification
**Version:** 1.0 (DB + Architecture Freeze)

---

## 1. Introduction

This document defines the full functional and technical specifications for the **Integrated Procurement & Stores Management System** for Fossil. The system is designed to digitize, control, and secure the entire procurement lifecycle while ensuring transparency, accountability, auditability, and operational efficiency.

The platform will replace all manual and semi-manual procurement, requisition, and stores processes with a centralized digital workflow accessible to internal staff and external suppliers.

---

## 2. Objectives of the System

The system is designed to achieve the following objectives:

* Eliminate all manual purchase requisitions and paper-based processes
* Enforce structured approval workflows across all departments
* Ensure transparent and tamper-proof supplier quotation handling
* Digitize supplier onboarding and compliance management
* Provide real-time visibility into procurement, inventory, and spend
* Strengthen governance, accountability, and audit readiness
* Improve efficiency, turnaround times, and cost control

---

## 3. Technology Stack

### Frontend

* React (Vite or Next.js)
* Tailwind CSS / UI framework
* Role-based dashboards
* Mobile-friendly responsive design (especially for approvals)

### Backend

* Node.js with Express.js
* RESTful API architecture
* JWT authentication
* Role-Based Access Control (RBAC)

### Database

* MongoDB (document-based, audit-friendly)

### Supporting Services

* Email service (SMTP / SendGrid)
* File storage (S3-compatible or Azure Blob Storage)
* WhatsApp API (future enhancement)
* Central audit logging service

---

## 4. User Roles & Responsibilities

The system operates entirely on role-based access. Every person (including suppliers) logs in as a user.

### Roles Supported

* **Department Head**

  * Raise purchase requisitions
  * Approve departmental requests
  * View procurement progress

* **Procurement Officer**

  * Create RFQs
  * Manage supplier engagement
  * Evaluate quotations
  * Generate purchase orders

* **Supplier**

  * Log in to supplier portal
  * Maintain company profile
  * Upload compliance documents
  * Receive RFQs
  * Submit quotations digitally
  * Track POs and delivery status

* **Finance**

  * Validate budget availability
  * Approve financial commitments
  * Validate payment terms

* **COO**

  * Final approval for major procurements
  * Oversight dashboard visibility

* **Stores Officer**

  * Receive goods
  * Generate GRVs
  * Maintain inventory
  * Issue stock to departments

---

## 5. Core Business Rules

* All users must authenticate to access the system
* All actions are logged in audit logs
* Suppliers can only participate if their profile status is ACTIVE
* Quotations become immutable after submission
* Purchase Orders can only be generated from approved quotations
* Goods can only be received against an approved PO
* Inventory can only be adjusted through system transactions
* No entity is ever hard-deleted (soft-delete only)

---

## 6. Functional Modules

### 6.1 Authentication & User Management

* Secure login (JWT-based)
* Password reset functionality
* Role-based access control
* User activation and suspension

---

### 6.2 Supplier Onboarding & Management

Suppliers register and maintain a business profile containing:

* Company name and trading name
* Registration details
* Tax clearance information
* Banking details
* Contact persons
* Uploaded compliance documents

Procurement can:

* Approve suppliers
* Suspend suppliers
* Blacklist suppliers

Blacklisted suppliers are automatically excluded from RFQs and procurement activities.

---

### 6.3 Purchase Requisition Management

Departments raise requisitions digitally:

* Multi-item requisitions supported
* Each line item supports specifications
* System checks store availability before procurement is triggered
* Approval workflow enforced

Requisition statuses include:

* Draft
* Pending Approval
* Approved
* Rejected
* Sourcing

---

### 6.4 RFQ (Enquiry) Management

Procurement officers can:

* Create RFQs from approved requisitions
* Select suppliers from approved supplierProfiles
* Set deadlines for submissions
* Track which suppliers responded

RFQs are sent digitally via email (and future WhatsApp integration).

---

### 6.5 Quotation Management

Suppliers submit quotations only via the system.

Key controls:

* No uploads of externally edited documents
* All quotations follow system-defined structure
* Locked immediately after submission
* Full timestamp and audit trail retained

This prevents tampering and ensures fairness.

---

### 6.6 Automated Quotation Evaluation

The system supports scoring and ranking based on:

* Price
* Payment terms
* Delivery time
* Specification compliance
* Documentation completeness

Procurement reviews system-generated ranking and selects a supplier for approval.

---

### 6.7 Purchase Order Management

Purchase Orders are:

* Generated directly from approved quotations
* Assigned unique PO numbers
* Routed through approval workflow (Finance → COO)
* Digitally issued to suppliers

POs maintain full approval history and versioning.

---

### 6.8 Goods Receiving (Stores Only)

Stores is the sole authority for receiving goods.

Process:

* Supplier delivers goods with delivery note
* Stores validates against PO
* Stores captures GRV in system
* System updates inventory automatically
* Partial deliveries supported

No security cards or external sign-offs are involved.

---

### 6.9 Inventory & Stores Management

Features include:

* Real-time stock levels
* Stock in / stock out tracking
* Internal store requisitions by departments
* Reorder level alerts
* Item movement history
* Stock valuation tracking

---

### 6.10 Reporting & Dashboards

System provides management with real-time insights:

* Procurement spend reports
* Supplier performance reports
* Approval turnaround analysis
* Inventory valuation
* Stock movement reports
* Audit activity logs

---

## 7. Database Architecture (Collections Overview)

The system uses the following core collections:

* users
* supplierProfiles
* departments
* items
* inventory
* purchaseRequisitions
* rfqs
* quotations
* quotationEvaluations
* purchaseOrders
* deliveries (GRVs)
* storeTransactions
* storeRequisitions
* auditLogs

Each collection is designed to support traceability, governance, and scalability.

---

## 8. Security & Governance Controls

The platform enforces strong controls:

* Role-based permissions at API level
* Immutable audit logs
* Quotation locking
* Approval workflows enforced server-side
* IP logging on sensitive actions
* Soft delete for forensic traceability

These controls are aligned to corporate governance and external audit requirements.

---

## 9. Non-Functional Requirements

* High availability
* Scalable architecture
* Secure authentication
* Fast response times
* Mobile-friendly user experience
* Integration readiness (finance systems, ERP, banking systems)
* Extensible architecture for future modules

---

## 10. Future Enhancements (Phase 2+)

The architecture supports future expansion into:

* Budget management module
* Contract management
* Supplier performance SLAs
* WhatsApp-based supplier interaction
* ERP integration
* AI-driven spend optimization
* Multi-branch / multi-company support

---

## 11. Conclusion

This Integrated Procurement & Stores Management System provides Fossil with a robust, scalable, and enterprise-grade digital procurement platform. It introduces transparency, accountability, efficiency, and strong governance across all procurement and inventory operations.

The system is designed not only to solve current operational challenges but also to support Fossil’s long-term growth and compliance requirements.

---

**Document Status:** Approved for architecture, DB design, and MVP implementation
