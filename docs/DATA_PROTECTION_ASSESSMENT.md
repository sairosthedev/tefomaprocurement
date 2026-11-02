# Data Protection Assessment — Zimbabwe and South Africa

| | |
| --- | --- |
| System | Sourceline / Procureline Procurement |
| Laws assessed | Zimbabwe: Cyber and Data Protection Act [Chapter 12:07] (2021) and the Licensing of Data Controllers and Appointment of DPOs Regulations, SI 155 of 2024. South Africa: Protection of Personal Information Act 4 of 2013 (POPIA) |
| Status | **Draft for legal review.** Prepared from the system's design and code. It records what the system does and what is still open. It is not a legal opinion, and a lawyer qualified in each country should sign it off before it is relied on |
| Owner | System owner (see readiness item 7.2), with the group's Data Protection Officer / Information Officer |
| Review | Yearly, and before any South African unit goes live |

## 1. Summary

The system holds a small range of personal information: staff and supplier contact details, plus supplier bank details. That range is low risk except for the bank details. A changed account number redirects real payments, so bank details are the main fraud target. That is why the system protects them most heavily.

Most protections required by both laws are already built in: access by role, an audit trail, held bank changes, and encryption in transit. **What remains open is mainly administrative:** registration and licensing with each regulator, a named DPO and Information Officer, a check on where the database and email provider are hosted (cross-border transfer), privacy notices, and a written breach procedure. Section 8 lists them.

## 2. Roles under each law

| | Zimbabwe (CDPA) | South Africa (POPIA) |
| --- | --- | --- |
| Who decides why and how data is processed | Each operating company is a **data controller** | Each operating company is a **responsible party** |
| Who processes on its behalf | Hosting (MongoDB Atlas), application hosting (Vercel), email (Resend) are **data processors** | The same providers are **operators** (s20–21). A written contract with each is required |
| Regulator | POTRAZ, acting as the Data Protection Authority | Information Regulator |
| Registration | Data controller licence from POTRAZ (SI 155/2024) | Information Officer registered with the Regulator (s55, Regulation 4) |
| Named officer | Data Protection Officer appointed and notified to POTRAZ | Information Officer (by default the CEO) and any deputies |

**Note for South Africa:** POPIA also protects *juristic persons*. A supplier company's registration, tax and banking information is personal information there, not only its contact people's details.

## 3. Personal data inventory

| Data | Whose | Where in the system | Why it is held (lawful basis) | Who can see it |
| --- | --- | --- | --- | --- |
| Name, email, phone, role, department, last sign-in | Staff users | User records | Running the system, accountability for approvals (legitimate interest / contract of employment) | Administrators. Names appear on the records people approved |
| Password hash, one-time sign-in codes | Staff and supplier users | User records, sign-in codes | Security | No one. The hash is never returned, and codes are deleted a day after they expire |
| Contact people: name, position, email, phone | Suppliers | Supplier profile | Placing orders and contacting the supplier (performing the contract, CDPA s8 / POPIA s11(1)(b)) | Procurement, the COO, and the supplier itself |
| Company registration, tax and VAT numbers, address, directors, client references | Suppliers (juristic persons in South Africa) | Supplier profile and onboarding (KYS) documents | Supplier due diligence, tax compliance (legal obligation, legitimate interest) | Procurement, the COO, and the supplier itself |
| **Bank name, account name, account number, branch, account type** | Suppliers | Supplier profile; bank-change requests; the record of each payment | Paying invoices (contract) | Full account number: procurement, finance, admins, and the supplier itself. Everyone else, the audit trail and exports: last four digits only |
| Bank confirmation letters | Suppliers | Bank-change requests, KYS documents | Proving a bank change is genuine (fraud prevention) | Procurement and finance |
| IP address and browser of each action | All users | Audit trail | Security and accountability (legitimate interest) | Administrators |

The system does **not** hold special personal information as either law defines it, such as health, biometric, religious or criminal data. Nor does it hold identity numbers of individuals, unless a supplier uploads them inside a KYS document. Procurement should ask suppliers to redact director ID numbers on documents that do not need them.

## 4. Supplier bank details: the main risk

**Threat.** A fraudster pretends to be a supplier, or an insider changes the account on file, and the next payment goes to the wrong account. This is the most common payment fraud reported against businesses, and money sent this way is rarely recovered.

**Controls in the system:**

| Control | How it works |
| --- | --- |
| A change is held as a request, never written straight to the record | This applies to supplier self-service and, since this assessment, to staff edits as well. Staff edits were the remaining direct-write path, and it is now closed |
| Payments pause automatically | Payments stop while a bank-change request is open, so pressure to "pay urgently" cannot skip the check |
| Callback check | Someone confirms the change by phoning a number **already on file**. A number given in the request itself is refused, because it reaches whoever sent the request |
| Second approver | The approver must be neither the person who asked for the change nor the person who made the callback |
| Before/after record | The request keeps a field-by-field record of the change, and each payment records the account it was actually paid to |
| Masking | Account numbers appear in full only where money is moved or a change is checked. Lists, the COO's read-only view, the audit trail and the evidence pack show the last four digits |
| Monitoring | The evidence pack flags any payment made within 30 days after a bank change, and any approval that skipped the callback or the second approver |

**Residual risks to accept or address:**

1. Account numbers are stored in the database as plain text. They are protected by the database's own encryption at rest (MongoDB Atlas encrypts all cluster storage and backups) and by access controls, not by encryption inside the application. Encrypting the field inside the application would protect against a leaked database copy or backup. It is recommended once backups are in place (readiness item 2), so the key can be managed and recovered properly.
2. Every staff member who can open a supplier record in procurement or finance can read full account numbers. Access reviews (readiness item 7.7, and the access section of the evidence pack) are the control for this.
3. The callback depends on the phone number on file being genuine. Contact-person phone changes are recorded in the audit trail, but they are not held for approval.

## 5. The conditions of each law, checked

| Requirement | CDPA (Zimbabwe) | POPIA (South Africa) | Position |
| --- | --- | --- | --- |
| Processing has a lawful basis | s8 | s11 | Met. Section 3 gives the basis for each item |
| Only the data needed for the purpose | s13 | s10 | Met. No data beyond procurement needs is collected |
| Kept no longer than needed | s13 | s14 | **Now addressed** by the [Data Retention Policy](DATA_RETENTION_POLICY.md) |
| Data accurate and kept up to date | s13 | s16 | Met. Suppliers keep their own profiles current, and bank changes are verified |
| People told what is collected and why | s15 | s18 | **Open.** A privacy notice is needed on supplier registration and the sign-in page (action 5) |
| Security safeguards | s18 | s19 | Largely met. HTTPS, role-based access, audit trail, sign-in codes, bank-change control. Gaps: backups, penetration test, rate limiting (readiness items 2, 12, 13) |
| Processors bound by contract | s18 | s20–21 | **Open.** Confirm data processing terms are accepted for Atlas, Vercel and Resend (action 4) |
| Breach notification | s19: notify the Authority within 24 hours of becoming aware | s22: notify the Regulator and the people affected as soon as reasonably possible | **Open.** A written breach procedure is needed (action 6) |
| Rights of data subjects (access, correction, objection, deletion) | Part IV | s23–25 | Partly met. Suppliers can see and correct their own profiles. Requests beyond that go to the DPO / Information Officer by hand, within the legal time limits |
| Transfers outside the country | s28–29: only to countries with adequate protection, as authorised | s72: only with adequate protection, consent, or a contract | **Open.** Hosting is outside Zimbabwe and South Africa (action 3) |
| Registration and named officer | SI 155/2024 licence and DPO | Information Officer registration | **Open** (actions 1–2) |
| Direct marketing | s25 | s69 | Not applicable. The system sends only transactional emails |

## 6. Cross-border transfer

The database (MongoDB Atlas), the application (Vercel) and email delivery (Resend) run on cloud infrastructure that is very likely outside Zimbabwe and South Africa. The Atlas cluster region must be confirmed in the Atlas console and recorded here.

Both laws allow such transfers with safeguards. Under POPIA, the processor contract (data processing addendum / standard contractual terms) is the usual basis. Under the CDPA, transfers need adequate protection in the receiving country, as the Authority determines. POTRAZ's position on transfers to common cloud regions should be confirmed during licensing.

## 7. Data protection impact

| Risk | Likelihood | Impact | With controls |
| --- | --- | --- | --- |
| Payment redirected by a fake or insider bank change | Medium | High | Low (section 4) |
| Leaked database or backup exposes bank details | Low | High | Medium until the field is encrypted in the application (section 4, residual 1) |
| Staff account taken over | Medium | Medium | Low once two-factor sign-in is on again (readiness item 3) |
| Personal data kept indefinitely | High (before this work) | Low | Low (retention policy) |
| Supplier not told how their data is used | High (now) | Low | Low after the privacy notice |

## 8. Actions

| # | Action | Owner | Needed for |
| --- | --- | --- | --- |
| 1 | Apply for each Zimbabwean operating company's data controller licence and notify POTRAZ of its DPO | Legal / DPO | Zimbabwe, now |
| 2 | Register the Information Officer of each South African unit with the Information Regulator, and publish a PAIA manual | Legal | Before Phase 4 |
| 3 | Confirm the Atlas, Vercel and Resend regions, record them in section 6, and decide the transfer basis | System owner | Both |
| 4 | Accept or sign the data processing terms with Atlas, Vercel and Resend, and file copies | System owner | Both |
| 5 | Add a privacy notice to supplier registration and the sign-in page | Product | Both |
| 6 | Write a breach procedure that meets the 24-hour Zimbabwean deadline, and attach it to the incident process (readiness 7.4) | System owner / DPO | Both |
| 7 | Encrypt bank account numbers inside the application, once backups and key management exist | Engineering | Recommended |
| 8 | Run a quarterly access review from the evidence pack's access section | Administrators | Both |

## 9. Changes made with this assessment

- Staff edits to supplier bank details now raise a held change request instead of overwriting the account (`api/src/controllers/procurement/updateSupplier.controller.ts`).
- Account numbers are masked in supplier lists, read-only views, the audit trail and exports (`api/src/lib/bankMasking.ts`).
- A retention policy with automatic deletion of short-lived data (`api/src/services/retention.service.ts`).
- An auditor's evidence pack (`GET /api/admin/evidence-pack`, Audit Logs → Evidence pack).
