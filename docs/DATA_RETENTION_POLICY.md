# Data Retention Policy

| | |
| --- | --- |
| Applies to | Every business unit on Sourceline / Procureline Procurement |
| Status | Draft for approval by Finance and Legal |
| Enforced in | `api/src/services/retention.service.ts`. The periods below are held there as data, so change both together |
| Review | Yearly |

## Principles

1. **Financial and procurement records are kept for 7 years.** Zimbabwe's Income Tax Act and VAT Act require 6 years. South Africa's Companies Act requires 7 years and its Tax Administration Act 5. One 7-year period covers the longest of these in both countries.
2. **Personal data is kept only as long as its purpose lasts.** Both laws require this (CDPA s13, POPIA s14).
3. **The system deletes automatically only data that has no value as evidence.** Everything else is *reviewed, then disposed of* by a person, because a deletion cannot be undone and an open audit, dispute or legal hold can extend any period.
4. **A legal hold overrides this policy.** Records involved in an investigation, dispute or audit are kept until the hold is lifted.

## Periods

| Record | Kept for | Counted from | At the end |
| --- | --- | --- | --- |
| Purchase orders, invoices, payments, GRVs, quotations, RFQs, requisitions | 7 years | End of the financial year in which the record closed | Review, then dispose |
| Audit trail | 7 years | Date of the entry | Review, then dispose |
| Supplier bank-change requests, callback records, bank letters | 7 years | Date the request closed | Review, then dispose |
| Profiles of suppliers still trading, including contacts and bank details | While the relationship lasts | — | Kept |
| Profiles of dormant suppliers, and applications never approved | 2 years without activity (7 years if they ever traded) | Last change to the profile | Review, then dispose or anonymise |
| Blacklisted suppliers | 7 years | Date of blacklisting | Review, then dispose |
| Staff user accounts | 2 years after deactivation | Deactivation | Close the account. The person's name stays on the records they approved |
| In-app notifications | 12 months if read, 24 months if unread | Creation | **Deleted automatically** |
| Sign-in one-time codes | 1 day after expiry | Expiry | **Deleted automatically** |
| Backups | As set in the backup configuration (readiness item 2.2) | — | Expire automatically |

## How it is enforced

- **Automatic deletion** runs once a day for each business unit, as part of the scheduled jobs. It deletes only notifications and expired sign-in codes, and logs how many it removed.
- **Review, then dispose:** the evidence pack's `retention.recordsDueForReview` section counts the records past their period. Once a year, Finance and the system owner review that list and decide what to dispose of. Before anything is deleted, they record the decision (what, how many, who approved it) in the audit trail or the minutes.
- **Disposing of a supplier's personal data** means removing contact people, phone numbers and bank details, and keeping the company name. Orders and payments then remain intact as financial records.
- **Requests from data subjects** to delete their data are handled by the DPO / Information Officer against this table. Data still inside a legal retention period is kept, and the person is told why.
