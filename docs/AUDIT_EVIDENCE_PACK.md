# Auditor's Evidence Pack

A single export of the evidence an auditor needs to test the procurement controls, for a chosen period and one business unit.

## How to produce it

**From the app:** sign in as an administrator, open **Audit Logs**, and optionally set *From* and *To* in the filters. Then select **Evidence pack**. Without dates, the pack covers the last 12 months.

**From the API:** `GET /api/admin/evidence-pack?from=2026-01-01&to=2026-06-30` (administrators only).

The download is a JSON file named `evidence-pack_<unit>_<from>_<to>.json`. Each time a pack is generated, that is recorded in the audit trail.

Bank account numbers are masked to their last four digits throughout, so the pack can be handed to external auditors.

## How to read it

Each section contains the full population for the period and, separately, an `exceptions` list. **An empty exceptions list means the control held for the whole period.** The `summary` block at the top counts the exceptions in each section.

| Section | What it evidences | Exceptions it reports |
| --- | --- | --- |
| `accessReview` | Every staff account with its role, status and last sign-in. Counts by role | Active accounts unused for 90 days or more. All active administrators |
| `bankChangeControl` | Every bank-change request in the period: who asked, the callback (number called, who confirmed it, who made the call), who approved, and the fields changed | Approved without a callback. Approver was the requester or the person who made the callback. Approved without a supporting document |
| `payments` | Every payment, the account it was paid to, and who raised and completed it | Paid within 30 days after a bank change for that supplier (the "change, then pay" fraud pattern). Raised and completed by the same person. Bank transfer paid with no record of the account |
| `purchaseOrderApprovals` | Every PO with its full approval history: who approved, in which role, and when | Approved with no Finance approval. Over the COO threshold with no COO approval. The person who created the PO also approved it. One person approved at two stages |
| `quotationWaivers` | Every waiver of the three-quotation rule, with its type, reason and approver | Waivers with no reason recorded |
| `auditTrail` | Counts of recorded actions by type and record, the earliest entry held, failed sign-ins by account, and every user-administration and system action (accounts created or changed, data resets) | — (reviewed line by line) |
| `retention` | The retention policy in force, and counts of records past their period | — (input to the annual disposal review) |

## What an exception means

An exception is a lead to follow up, not proof of wrongdoing. Two examples:

- A payment made shortly after a *genuine*, verified bank change is normal. The auditor confirms the callback and the bank letter on that change request.
- An "approved without supporting document" result can be a change made before the bank letter became mandatory.

Each exception names the PO, payment or request it refers to, so the record can be opened in the app.

## Controls it maps to

These are the business rules in [BUSINESS_REQUIREMENTS_DOCUMENT.md](../BUSINESS_REQUIREMENTS_DOCUMENT.md) and the clauses in [PROCEDURE_COMPLIANCE.md](../PROCEDURE_COMPLIANCE.md):

- Segregation of duties in the PO approval chain, and the COO threshold
- The three-quotation minimum and its waiver
- Bank-detail change control (callback and second approver)
- Access management and the audit trail

## For a full audit, also provide

- [DATA_PROTECTION_ASSESSMENT.md](DATA_PROTECTION_ASSESSMENT.md) and [DATA_RETENTION_POLICY.md](DATA_RETENTION_POLICY.md)
- The backup configuration and the record of the last restore test (readiness item 2)
- The approved delegation-of-authority schedule for the unit, to compare against the approval chain (readiness item 15)
- An Audit Logs CSV export for any specific records the auditor samples
