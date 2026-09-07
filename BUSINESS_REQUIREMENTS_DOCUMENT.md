# Business Requirements Document

**System:** Tefoma Procurement — Integrated Procurement & Stores Management System
**Client:** Tefoma Construction
**Governing policy:** Central Procurement Procedure Rev 9.0 (25 November 2025)
**Document version:** 1.0
**Date:** 4 September 2026
**Status:** Baseline, reflecting the system as built

---

## 1. Document purpose and scope

### 1.1 Purpose

This document states the business requirements the Tefoma Procurement system was built to satisfy. It defines the problem, the scope, the stakeholders, the functional and non-functional requirements, the business rules the software enforces, and the acceptance criteria used to verify delivery.

It is written to be read by management and by testers. It is also the reference against which change requests are assessed.

### 1.2 Scope

**In scope.** The full procure-to-pay cycle for goods and services: demand capture, stock verification, competitive sourcing, supplier compliance, award, purchase ordering, approval, receiving, inventory control, supplier invoicing, payment recording, reporting and audit.

**Out of scope.** General ledger and financial accounting, payroll, fixed asset registers, project costing, petty cash, bank payment execution, and tender publication in the press. The system records that a payment was made; it does not move money.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| BRD | Business Requirements Document, this document |
| GRV | Goods Received Voucher, the record proving goods physically arrived |
| HOD | Head of Department |
| IR / PR | Internal Requisition / Purchase Requisition, a request for goods or services |
| KYS | Know Your Supplier, the supplier compliance vetting pack |
| OTP | One-Time Password, the six-digit code emailed at every sign-in |
| PO | Purchase Order, the formal order placed with a supplier |
| PRAZ | Procurement Regulatory Authority of Zimbabwe |
| RFQ | Request for Quotation, the invitation to suppliers to bid |
| SEC | Supplier Evaluation Committee |
| Three-way match | Comparison of what was ordered, what was received and what was invoiced |

---

## 2. Business context

### 2.1 The problem

Procurement at Tefoma Construction was conducted on paper and by email. This produced six recurring business problems.

1. **No visibility.** Once a requisition left a department, its status was unknown without telephoning whoever held the paper. Sites could not plan around lead times.
2. **Duplicate purchasing.** Stores was not reliably consulted before buying, so items already held were bought again.
3. **Weak sourcing discipline.** Quotations arrived by email, could be altered, mislaid, or received after a decision had effectively been made. The three-quotation rule was difficult to evidence.
4. **Unenforced approval authority.** Whether an order was properly authorised depended on who had signed a document, and signatures could be obtained out of sequence or after the fact.
5. **Payment exposure.** Invoices were approved without a systematic check against what had been ordered and what had actually been received, creating exposure to overbilling, duplicate invoicing and payment for undelivered goods.
6. **Audit difficulty.** Reconstructing why a particular supplier was chosen, or who authorised a payment, required searching physical files.

### 2.2 Business objectives

| # | Objective | Measure of success |
|---|---|---|
| BO-1 | Make every purchase request traceable end to end | Any request can be located by number, with its current status and full history, within seconds |
| BO-2 | Stop the company buying what it already holds | Every approved requisition passes a mandatory stores check before procurement can source it |
| BO-3 | Enforce competitive, evidenced sourcing | Three quotations per line, or a documented and approved waiver, in every case |
| BO-4 | Enforce delegated financial authority | The approval sequence cannot be skipped or reordered; the COO threshold is applied automatically |
| BO-5 | Prevent improper payment | No invoice without a purchase order; no approval without a stores receipt and a three-way match |
| BO-6 | Trade only with vetted suppliers | No supplier can quote until compliance documentation is verified |
| BO-7 | Produce an audit trail without extra effort | Every material action is logged with actor, timestamp and network address |
| BO-8 | Encode the Rev 9 procedure in software | Policy rules operate as system constraints, not as guidance |

### 2.3 Constraints and assumptions

**Constraints.**

- The system must implement the Central Procurement Procedure Rev 9.0. Where the procedure and convenience conflict, the procedure governs.
- Users are distributed across sites with variable connectivity, so the system must be usable on a mobile browser, particularly for approvals.
- Suppliers are external parties with no company network access and varying levels of technical skill.
- Operating currency is primarily United States Dollars, with Zimbabwean Gold and South African Rand also required.

**Assumptions.**

- Every user, including each supplier contact, has an email address they can access, because sign-in depends on an emailed code.
- Stores maintains inventory records in the system rather than in parallel spreadsheets.
- The company retains ownership of the source code and the data.

---

## 3. Stakeholders and users

### 3.1 Stakeholders

| Stakeholder | Interest in the system |
|---|---|
| Chief Executive Officer | Spend control, governance, ability to report to the board and to investors |
| Chief Operating Officer | Authorisation of significant commitments, operational oversight |
| Finance | Budget discipline, payment integrity, audit readiness |
| Procurement | Sourcing efficiency, supplier base quality, defensible award decisions |
| Stores | Accurate inventory, controlled receiving, evidence of what arrived |
| Departments and sites | Speed and visibility on the things they need to do their work |
| Suppliers | Fair access to opportunities, clarity on what is required, timely payment |
| External auditors | Evidence that policy was followed |

### 3.2 User roles

| Role | Primary responsibility in the system |
|---|---|
| End User | Raises purchase requisitions for their department. Sees only their own requests |
| Department Head | Approves departmental requisitions and purchase orders. Selects the winning quotation with a written justification |
| Stores Officer | Verifies stock against requisitions, issues stock, receives deliveries and raises GRVs, maintains inventory and inter-site transfers |
| Procurement Officer | Manages suppliers and KYS, issues RFQs, manages quotations and awards, raises purchase orders, records supplier evaluations |
| Procurement Head | The Head of the Procurement Department. Additionally authorises quotations and provides the second departmental approval on purchase orders |
| Finance Manager | Maintains department budgets, approves purchase orders financially, approves supplier invoices, records payments |
| Chief Operating Officer | Approves purchase orders at or above the value threshold. Oversight reporting |
| Supplier | External. Maintains company profile and compliance documents, responds to RFQs, acknowledges orders, submits invoices |
| System Administrator | Manages users, departments and sites. Reviews audit logs. Full oversight |

### 3.3 Separation of duties

The role design deliberately prevents any single person from completing a purchase alone. The requester cannot approve. The approver cannot receive. The receiver cannot pay. A purchase at or above the threshold requires four distinct approvals in sequence.

---

## 4. Functional requirements

Requirements are grouped by business process. Each carries an identifier for traceability to the test guide and to the compliance matrix.

### 4.1 Access and identity

| ID | Requirement | Priority |
|---|---|---|
| FR-A1 | Every user shall authenticate with an email address and password before accessing any function | Must |
| FR-A2 | Sign-in shall require a one-time code sent to the user's registered email address | Must |
| FR-A3 | The system shall present functions strictly according to the signed-in user's role; attempts to reach unauthorised functions shall be refused | Must |
| FR-A4 | Users shall be able to reset a forgotten password without administrator intervention | Must |
| FR-A5 | Suppliers shall use a separate sign-in route from staff and shall never see internal functions | Must |
| FR-A6 | Prospective suppliers shall be able to register themselves for review | Should |
| FR-A7 | Passwords shall be stored only in irreversibly hashed form | Must |

### 4.2 Organisation setup

| ID | Requirement | Priority |
|---|---|---|
| FR-O1 | Administrators shall create and maintain departments, and designate a head for each | Must |
| FR-O2 | Administrators shall create and maintain sites, so that inventory and deliveries are site-specific | Must |
| FR-O3 | Administrators shall create staff users, assign a role, a department and a home site | Must |
| FR-O4 | No record shall be permanently destroyed; deactivation shall preserve history | Must |

### 4.3 Purchase requisitions

| ID | Requirement | Priority |
|---|---|---|
| FR-R1 | An End User shall raise a requisition with a title, description, urgency, delivery site and one or more line items | Must |
| FR-R2 | Line items shall be selectable from the stock catalogue or entered as free text, and shall carry a controlled category | Must |
| FR-R3 | For plant, vehicle and machinery lines, the requester shall be able to record equipment identity: make, model, plant or fleet number, registration, chassis or VIN, engine number, machine serial, component serial, part number and hours or odometer reading | Must |
| FR-R4 | The requester shall be able to attach photographs to a line, classified by purpose, including a machine data plate | Must |
| FR-R5 | The equipment panel shall present itself automatically for categories where it is relevant, and remain out of the way for ordinary lines | Should |
| FR-R6 | A submitted requisition shall route to the head of the requester's department for approval or rejection with a reason | Must |
| FR-R7 | An End User shall see only their own requisitions; a Department Head shall see the whole department's | Must |
| FR-R8 | A requisition shall be cancellable, subject to role and status, with a reason selected from a controlled list, and cancellation shall propagate to any linked RFQ or purchase order | Must |

### 4.4 Stores verification

| ID | Requirement | Priority |
|---|---|---|
| FR-S1 | Every requisition approved by a Department Head shall enter a stores queue before procurement can act on it | Must |
| FR-S2 | Stores shall be able to check stock on hand at the delivery site and at other sites | Must |
| FR-S3 | Stores shall be able to issue available stock against a requisition line, reducing inventory accordingly | Must |
| FR-S4 | Where stock fully satisfies the requisition, the requisition shall close without reaching procurement | Must |
| FR-S5 | Where stock is insufficient, only the shortfall shall be forwarded to procurement | Must |
| FR-S6 | Stores shall see the equipment identity and photographs recorded by the requester | Must |

### 4.5 Sourcing and quotations

| ID | Requirement | Priority |
|---|---|---|
| FR-Q1 | Procurement shall create an RFQ from a forwarded requisition, with a submission deadline | Must |
| FR-Q2 | The system shall suggest active suppliers whose registered categories match the requisition lines | Should |
| FR-Q3 | Only suppliers in active status shall be invitable to an RFQ | Must |
| FR-Q4 | Invited suppliers shall be notified, and shall see the RFQ including equipment identity and photographs | Must |
| FR-Q5 | Suppliers shall submit priced quotations line by line through the portal | Must |
| FR-Q6 | A supplier shall be able to declare that a line is an equivalent or alternative item, stating what it is and its part number, and attaching a photograph | Must |
| FR-Q7 | Quotation prices shall remain concealed from procurement until the RFQ deadline passes or the RFQ is formally closed | Must |
| FR-Q8 | A submitted quotation shall be immutable. A price change shall require procurement to request a revision, and the supplier to submit a new version, with the prior version retained as superseded | Must |
| FR-Q9 | Where an alternative was offered, the system shall warn the buyer prominently before the award decision | Must |

### 4.6 Award and purchase orders

| ID | Requirement | Priority |
|---|---|---|
| FR-P1 | Award shall be made per RFQ line, so that different lines on one RFQ may be awarded to different suppliers | Must |
| FR-P2 | At least three live quotations shall exist for a line before it can be awarded, unless a waiver is approved | Must |
| FR-P3 | A waiver shall require a reason category drawn from the PRAZ-aligned list and a written explanation, and shall be recorded against the award | Must |
| FR-P4 | An award shall require two distinct actions: selection by the requesting Head of Department with a written justification, and authorisation by the Procurement Manager | Must |
| FR-P5 | The system shall generate one purchase order per winning supplier from the award | Must |
| FR-P6 | Lines that received no quotation, or that were not awarded, shall be identified and shall be re-sourceable into a new RFQ so that no demand is lost | Must |
| FR-P7 | A requisition shall be treated as complete only when every line is ordered, issued from stock, or explicitly cancelled | Must |

### 4.7 Purchase order approval

| ID | Requirement | Priority |
|---|---|---|
| FR-V1 | A purchase order shall pass, in strict sequence, the head of the requesting department, the head of Procurement, and Finance | Must |
| FR-V2 | A purchase order whose total is at or above USD 5,000 shall additionally require Chief Operating Officer approval, applied automatically | Must |
| FR-V3 | No approval stage shall be skippable or performable out of sequence | Must |
| FR-V4 | Each approver shall have a queue of the orders awaiting their decision | Must |
| FR-V5 | A rejection shall require a reason and shall halt the order | Must |
| FR-V6 | The approval state of every stage shall be visible on the order, including stages not required | Must |
| FR-V7 | A purchase order shall be cancellable subject to role and status, with a controlled reason, and shall be blocked from cancellation once a delivery or invoice exists against it | Must |

### 4.8 Supplier management and compliance

| ID | Requirement | Priority |
|---|---|---|
| FR-K1 | A newly created or self-registered supplier shall be in pending status and shall not be able to trade | Must |
| FR-K2 | The system shall hold the full Know Your Supplier checklist of nineteen items, each marked mandatory or optional | Must |
| FR-K3 | Suppliers shall upload their own compliance documents; procurement shall also be able to upload on their behalf | Must |
| FR-K4 | An uploaded document shall automatically satisfy the checklist item it corresponds to, and completion shall be recalculated | Must |
| FR-K5 | A verified document shall not be deletable | Must |
| FR-K6 | A supplier shall become active only when compliance is verified by procurement, or by a documented override carrying a written reason | Must |
| FR-K7 | Procurement shall be able to suspend, mark dormant, reactivate or blacklist a supplier, each action requiring a reason and generating a notification and an audit entry | Must |
| FR-K8 | Suppliers shall classify themselves against a controlled taxonomy of categories, validated on entry and on bulk import | Must |
| FR-K9 | Procurement shall record supplier evaluations scored against seven criteria, producing an overall score and a next review date | Must |
| FR-K10 | The system shall report supplier performance rankings and compliance coverage across the supplier base | Should |

### 4.9 Receiving and inventory

| ID | Requirement | Priority |
|---|---|---|
| FR-G1 | Goods shall be receivable only by Stores, and only against an approved purchase order | Must |
| FR-G2 | Receiving shall capture the delivery note number, date, quantities, and the identity of the person and vehicle that delivered | Must |
| FR-G3 | Receipt shall support full acceptance, partial acceptance and rejection with notes | Must |
| FR-G4 | Accepted goods shall increase inventory at the receiving site automatically | Must |
| FR-G5 | A Goods Received Voucher shall be generated and printable as a formal document showing the order, supplier, items and signature blocks | Must |
| FR-G6 | Inventory shall be maintained per site, with bin locations and reorder levels | Must |
| FR-G7 | Every inventory movement shall be recorded and reviewable | Must |
| FR-G8 | Stock shall be transferable between sites through a ship-and-receive sequence | Must |
| FR-G9 | Departments shall be able to requisition stock from stores directly, without a purchase | Must |
| FR-G10 | Opening balances shall be importable in bulk from the existing stock code list | Must |

### 4.10 Invoicing and payment

| ID | Requirement | Priority |
|---|---|---|
| FR-I1 | An invoice shall be submittable only against an existing purchase order | Must |
| FR-I2 | The system shall perform a three-way match comparing ordered quantities and values, received quantities from stores GRVs net of rejections, and invoiced quantities and values | Must |
| FR-I3 | The match tolerance shall be two percent or one United States Dollar, whichever is the greater | Must |
| FR-I4 | Any variance shall be explained in plain language, line by line | Must |
| FR-I5 | Finance shall not be able to approve an invoice unless a stores GRV exists for the order | Must |
| FR-I6 | Where Finance overrides a failed match, the override and its reason shall be recorded | Must |
| FR-I7 | Payments shall be recordable against approved invoices, tracking amount paid and balance outstanding through submitted, approved, partially paid and paid | Must |

### 4.11 Budgets

| ID | Requirement | Priority |
|---|---|---|
| FR-B1 | Finance shall allocate a budget to each department for a financial year | Must |
| FR-B2 | The system shall show, per department, the allocation, the amount committed by open purchase orders, the amount utilised through payments, and the balance available | Must |
| FR-B3 | The system shall commit budget at the point a requisition is raised and block or flag requests that exceed the available balance | Should, not yet delivered |

### 4.12 Notification, reporting and audit

| ID | Requirement | Priority |
|---|---|---|
| FR-N1 | Every workflow hand-off shall generate an in-app notification to the party who must act | Must |
| FR-N2 | Key events shall additionally generate an email where email is configured | Must |
| FR-N3 | The system shall raise scheduled alerts for stock below reorder level and for approaching RFQ deadlines, without duplicating alerts | Should |
| FR-N4 | Each role shall have a dashboard showing the work awaiting them and the measures relevant to their responsibility | Must |
| FR-N5 | The system shall report procurement spend, supplier registry, supplier scores and compliance coverage, with export | Must |
| FR-N6 | Every create, update, approval, rejection, upload, status change and sign-in shall be written to an audit log recording the actor, the entity, the time and the network address | Must |
| FR-N7 | The audit log shall be searchable and filterable by administrators, and exportable | Must |

---

## 5. Business rules

These are the rules the software enforces. They are stated separately because they are the substance of the control environment and are the items an auditor will test.

| ID | Rule |
|---|---|
| BR-1 | No user may access any function without authenticating, including a one-time emailed code |
| BR-2 | A supplier may not quote unless compliance is verified and the supplier is active |
| BR-3 | No purchase may proceed without an approved requisition |
| BR-4 | No requisition may reach procurement without passing the stores stock check |
| BR-5 | No line may be awarded without three live quotations or an approved, reasoned waiver |
| BR-6 | No award is valid without both the departmental head's justified selection and the Procurement Manager's authorisation |
| BR-7 | Purchase order approvals occur in a fixed sequence and none may be skipped |
| BR-8 | A purchase order at or above USD 5,000 requires Chief Operating Officer approval |
| BR-9 | Goods may be received only by Stores and only against an approved purchase order |
| BR-10 | An invoice may exist only against a purchase order |
| BR-11 | Finance may not approve an invoice without a stores receipt and a passing three-way match, unless an override is recorded with a reason |
| BR-12 | A submitted quotation is immutable; changes create a new version and retain the old |
| BR-13 | Quotation prices are concealed until the RFQ closes |
| BR-14 | No record is ever destroyed; cancellation and deactivation preserve history |
| BR-15 | Every material action is attributable to a named user, with time and network address |

---

## 6. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Availability | The system is hosted on managed cloud infrastructure and is reachable over the public internet without a virtual private network |
| NFR-2 | Usability | Approval actions shall be completable on a mobile browser |
| NFR-3 | Usability | Users shall require no more than a short briefing to perform their role, supported by a step-by-step guide |
| NFR-4 | Security | Transport shall be encrypted. Credentials shall never be stored in reversible form. Access shall be enforced on the server, not merely hidden in the interface |
| NFR-5 | Security | Sign-in shall use two factors: a password and a code delivered to a separate channel |
| NFR-6 | Auditability | The audit record shall be append-only in effect, and shall not be editable through the application |
| NFR-7 | Data integrity | Business rules shall be enforced by the server so that they cannot be bypassed by manipulating the browser |
| NFR-8 | Maintainability | Domain constants shall be defined once and shared by the server and the browser application so the two cannot diverge |
| NFR-9 | Maintainability | The codebase shall be strongly typed so that a class of defects is caught before deployment |
| NFR-10 | Scalability | The system shall support multiple sites, multiple departments and multiple currencies without code change |
| NFR-11 | Portability | The company shall own the source code and the data, with no per-seat licensing |
| NFR-12 | Localisation | The system shall operate in United States Dollars, Zimbabwean Gold and South African Rand |

---

## 7. Process flow

The end-to-end business process the system implements.

```
1.  End User raises a requisition, with equipment identity and photographs where relevant
2.  Department Head approves or rejects
3.  Stores checks stock; issues what is held, forwards only the shortfall
4.  Procurement accepts and raises an RFQ; suppliers are suggested by category
5.  Invited suppliers quote line by line; prices stay sealed until close
6.  Procurement closes the RFQ and reveals bids
7.  Department Head selects per line with justification; Procurement Manager authorises
8.  Purchase orders are generated, one per winning supplier
9.  Approval sequence: requesting Head, Procurement Head, Finance, and COO at or above USD 5,000
10. Supplier acknowledges the order and delivers
11. Stores receives, inspects, raises and prints the GRV; inventory increases
12. Supplier submits an invoice against the order
13. Three-way match runs; Finance approves and records payment
```

A requisition satisfied entirely from stock terminates at step 3. Lines receiving no quotation are captured at step 7 and re-sourced through a fresh RFQ.

---

## 8. Acceptance criteria

The system is accepted when the following are demonstrated.

| ID | Acceptance criterion | Verified by |
|---|---|---|
| AC-1 | A requisition can be carried end to end from raising to payment by the appropriate roles in sequence | End-to-end test, 49 automated checks |
| AC-2 | Each role can sign in, receive a one-time code, and reach only the functions belonging to that role | Role smoke test, 103 automated checks |
| AC-3 | A user attempting a function outside their role is refused by the server | Role smoke test, refusal check |
| AC-4 | Equipment identity and photographs entered on a requisition are visible to the approver, to stores, and to the invited supplier | Manual test, guide steps 1 to 6 |
| AC-5 | Quotation prices remain concealed until the RFQ is closed | Manual test, guide step 7 |
| AC-6 | A line with fewer than three quotations cannot be awarded without a reasoned waiver | Manual test, guide step 7 |
| AC-7 | A purchase order cannot reach approved status without every required approval, in order | Manual test, guide step 8 |
| AC-8 | The COO stage is required at or above USD 5,000 and not required below it | Manual test, guide step 8 |
| AC-9 | Received goods increase inventory, and a formal GRV can be printed | Manual test, guide step 10 |
| AC-10 | An invoice failing the three-way match is refused, and any override is recorded | Manual test, guide step 11 |
| AC-11 | The audit log contains the full trail of the test run | Manual test, guide step 12 |
| AC-12 | A supplier cannot be activated with incomplete compliance except by a documented override | Manual test, supplier section |

---

## 9. Delivery status against requirements

| Area | Status |
|---|---|
| Access and identity, sections 4.1 | Delivered |
| Organisation setup, 4.2 | Delivered |
| Purchase requisitions, 4.3 | Delivered |
| Stores verification, 4.4 | Delivered |
| Sourcing and quotations, 4.5 | Delivered |
| Award and purchase orders, 4.6 | Delivered |
| Purchase order approval, 4.7 | Delivered |
| Supplier management and compliance, 4.8 | Delivered |
| Receiving and inventory, 4.9 | Delivered |
| Invoicing and payment, 4.10 | Delivered |
| Budgets, 4.11 | Partially delivered. Allocation, commitment and utilisation are visible. Blocking of over-budget requests, FR-B3, is not built |
| Notification, reporting and audit, 4.12 | Delivered |

### 9.1 Known gaps

| Gap | Requirement | Business consequence | Recommended priority |
|---|---|---|---|
| Budget is not enforced at the point of request | FR-B3 | A department can commit beyond its allocation; the overspend is visible only after the fact | 1, highest |
| Procedure timing targets are not tracked | Rev 9 timelines | Delays are not surfaced or measurable | 2 |
| The purchase order is not emailed to the supplier as a document | Rev 9 clause 6.3.14 | Suppliers are notified in the portal but receive no formal document by email | 3 |
| The printed GRV does not record who inspected the goods | Rev 9 clause 6.6.2 | Deliveries received in full are auto-accepted, so the inspection signature block prints blank | 3 |
| An RFQ can be started while a requisition is still in stores review | BR-4 | The stores check can be bypassed in that specific sequence | 3 |
| Supplier site visit records are not held | Rev 9 clause 5.5 | Field vetting is done outside the system | 4 |
| Safety data sheets for hazardous materials are not captured | Rev 9 clause 6.6.3 | Compliance evidence held outside the system | 4 |
| Receiving attendance by maintenance, security and safety representatives is not recorded | Rev 9 clause 6.8.5 | Attendance evidenced outside the system | 4 |
| Return of non-conforming goods within five days is not tracked | Rev 9 clauses 6.6.7 to 6.6.9 | Returns managed manually | 4 |

---

## 10. Change control

Changes to this baseline follow this route.

1. The requester states the business need and the consequence of not meeting it.
2. The change is assessed against the Rev 9 procedure. A change that would weaken a control in section 5 requires management approval, recorded.
3. The change is sized and scheduled.
4. On delivery, the relevant acceptance criterion in section 8 and the testing guide are updated.

---

*Companion documents: Executive Briefing, System Overview, Procedure Compliance Matrix, Access and Credentials, Tester Guide, Smoke and End-to-End Test Results.*
