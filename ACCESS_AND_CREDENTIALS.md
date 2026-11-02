# Access, URLs and Credentials

**System:** Tefoma Procurement
**Date:** 4 September 2026
**Classification: Confidential. Contains live administrator and test credentials. Do not circulate outside the project team.**

---

## Handling notice

This document lists the addresses of the system, the **live administrator** credential in section 3.0, and the **test account** credentials used for demonstration and user acceptance testing.

It deliberately **does not contain** production secrets: the database connection string, the token signing secret, and the email service key. Those are held in the server environment configuration and are handed over separately, in person or through a password manager, never in a document that may be forwarded. Section 6 lists what they are so that the handover is complete.

If this document is shared with anyone outside the project team, change the passwords first, starting with the live administrator account in section 3.0.

---

## 1. Addresses

### 1.1 Live system

| What | Address |
|---|---|
| Application | https://tefomaprocurement.vercel.app |
| Staff sign-in | https://tefomaprocurement.vercel.app/login |
| Supplier sign-in | https://tefomaprocurement.vercel.app/supplier/login |
| Supplier self-registration | https://tefomaprocurement.vercel.app/register |
| Forgotten password | https://tefomaprocurement.vercel.app/forgot-password |

Staff and suppliers both start at the application address and choose their portal on the sign-in screen.

### 1.2 Source code

| What | Address |
|---|---|
| Repository | https://github.com/sairosthedev/tefomaprocurement |
| Default branch | `main` |

### 1.3 Hosting and services

| Service | Purpose | Where it is administered |
|---|---|---|
| Vercel | Hosts the application and the interface layer | vercel.com, project owner's account |
| MongoDB Atlas | Hosts the database | cloud.mongodb.com, cluster `l8hh6la`, database `fosssil-procure` |
| Resend | Sends one-time codes, password resets and workflow email | resend.com |

Sender address on outbound email: `Tefoma Construction Procurement <notifications@miccstech.co.zw>`

### 1.4 Local development addresses

| What | Address |
|---|---|
| Interface layer | http://localhost:3001 |
| Application | http://localhost:5173 |

---

## 2. How sign-in works

Every sign-in, for staff and suppliers alike, takes three steps.

1. Enter the email address and password.
2. The system emails a six-digit code to that address.
3. Enter the code to complete sign-in.

This means **the email address on an account must be a mailbox someone can actually open**. An account with an unreachable address cannot sign in. The code expires after a short period; if it lapses, sign in again for a fresh one. Check the spam folder if it does not arrive within two minutes.

---

## 3. Accounts

### 3.0 Live administrator

| Role | Name | Email | Password |
|---|---|---|---|
| System Administrator | Webster Maposa | Webster.Maposa@dokuma.co.zw | `password` |

This account was created on the live system on 4 September 2026 and is active.

**This password must be changed.** `password` is the most commonly guessed credential in
existence, and this account can create users, change roles, read supplier banking details
and view every payment record. Anyone who reaches the sign-in page can try it in a single
guess. The emailed one-time code is the only thing standing behind it, which means the
security of the whole system currently rests on one mailbox.

Change it at first sign-in through **Profile**, and choose something long and unique. Until
then, treat this document as highly sensitive.

The address must be a mailbox Webster Maposa can open, because every sign-in sends a
six-digit code to it.

### 3.1 Test accounts

All accounts in the two tables below share the password `Admin@123`.

These are seeded demonstration accounts. **Change the password on any account that is carried into live use**, and delete the rest before the system holds real commercial data.

### 3.2 Staff

| Role | Name | Email | Department |
|---|---|---|---|
| System Administrator | System Admin | admin@fossilzim.com | — |
| Procurement Officer | Macdonald Sairo | macdonald@fossilzim.com | Procurement |
| Department Head, Procurement | John Banda | jb@fossilzim.com | Procurement |
| Department Head, ICT | Mac Chikwana | mac@fossilzim.com | ICT |
| Finance Manager | Paul Kofa | paul@fossilzim.com | Finance |
| Chief Operating Officer | Tino Moyo | tino@fossilzim.com | — |
| Stores Officer | Alfred Ncube | alfred@fossilzim.com | Stores |
| End User | James Mutendi | james@fossilzim.com | ICT |

The two Department Head accounts are both needed. A purchase order is approved first by the head of the requesting department, Mac Chikwana for an ICT request, and then by the head of Procurement, John Banda.

### 3.3 Suppliers

| Company | Email | Speciality |
|---|---|---|
| TechZone Hardware | ict.hw@techzone.co.zw | ICT hardware |
| CodeBridge | ict.sw@codebridge.co.zw | Software |
| ProFix | ict.maint@profix.co.zw | Maintenance |
| NetLink | ict.telecom@netlink.co.zw | Telecommunications |
| RadioCom | ict.radio@radiocom.co.zw | Radio equipment |
| Precision Cal | ict.calib@precisioncal.co.zw | Calibration |

Three suppliers are needed to test the competitive quotation rule without invoking a waiver. The first three above are the ones used in the automated end-to-end test.

### 3.4 A note on these email addresses

These are seeded addresses on the `fossilzim.com` and supplier domains. If they are not mailboxes your team can open, the one-time code will not reach you and you will not be able to sign in with them.

For user acceptance testing, the reliable approach is for the administrator to create fresh accounts using **email addresses your testers genuinely control**, following section 4.

---

## 4. Creating your own test accounts

Sign in as the administrator, then:

1. Open **Departments** and create the departments you will use, for example ICT, Operations, Finance, Stores, Procurement. Designate a head for each.
2. Open **Sites** and confirm a head office site exists. Add a second site if you intend to test stock transfers.
3. Open **Staff Team** and add one user per role from the table in section 3.2, using real email addresses and a password of at least six characters. Assign the department, and for the stores officer a home site.
4. Open **Suppliers** and add at least three, each with a real contact email address, then complete and verify their compliance documentation so they reach active status.

Record what you create. A simple table of name, email, role and password, kept somewhere secure, saves considerable time.

| Role | Email | Password | Notes |
|---|---|---|---|
| End User | | | |
| Department Head, requesting department | | | |
| Department Head, Procurement | | | |
| Stores Officer | | | |
| Procurement Officer | | | |
| Finance Manager | | | |
| Chief Operating Officer | | | Only needed above USD 5,000 |
| Supplier A | | | |
| Supplier B | | | |
| Supplier C | | | |

---

## 5. Existing test data to be aware of

The live system currently holds leftover data from earlier testing. Supplier records whose names begin `SPLIT-`, `SMOKE-` or `NEG-` are artefacts of automated test runs, not real vendors. They should be removed before the system goes into commercial use.

---

## 6. Production secrets, handed over separately

The following are held in the server environment configuration. They are **not** reproduced here. Confirm you have received each one before treating the handover as complete.

| Setting | What it is | Held where |
|---|---|---|
| `MONGODB_URI` | Database connection string, including credentials | Vercel project environment variables, and MongoDB Atlas |
| `JWT_SECRET` | The key used to sign session tokens. Anyone holding it can forge a session as any user | Vercel project environment variables |
| `RESEND_API_KEY` | The key used to send email, including one-time codes | Vercel project environment variables, and the Resend account |
| Vercel account | Deployment and hosting control | Project owner's account |
| MongoDB Atlas account | Database administration, backups, network access rules | Project owner's account |
| Resend account | Email sending domain and reputation | Project owner's account |
| GitHub repository access | Source code | github.com/sairosthedev |

Non-secret configuration in the same file, recorded here for completeness: the port, environment name and log level; the token lifetime; the company and product names used in branding; the application address used in email links; and the settings governing scheduled alerts, being whether they run, how often, the de-duplication window, how far ahead RFQ deadlines are flagged, and the default low-stock threshold.

### 6.1 Recommended actions on handover

1. Rotate the token signing secret and the email service key, so that anyone who saw them during development no longer holds working credentials.
2. Create a database user for the application with only the permissions it needs, and restrict network access to the hosting provider.
3. Change the live administrator password in section 3.0. This is the most urgent item on this list.
4. Change the password on every seeded account that will remain in use, and delete the rest.
5. Remove the leftover test supplier records described in section 5.
6. Confirm that at least two people in the company hold the hosting and database account credentials, so the system is not dependent on one individual.

---

## 7. Support and escalation

| Need | Contact |
|---|---|
| Account creation, password reset, role change | System administrator |
| A defect or unexpected behaviour | Project team, following the reporting format in the tester guide |
| Hosting, database or email service issues | Project owner |

---

*Companion documents: Executive Briefing, Business Requirements Document, Tester Guide, System Overview.*
