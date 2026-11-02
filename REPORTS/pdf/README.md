# Tefoma Procurement — Document Pack

Generated 4 September 2026 from the repository markdown sources. Document 04 was revised
the same day to add the live administrator account. Regenerate with the converter in the
project scratchpad after editing any source document.

| # | Document | For whom | What it is |
|---|---|---|---|
| 01 | Executive Briefing | CEO, investors, senior management | What the system is, what it controls, what has been delivered and what remains |
| 02 | Business Requirements Document | Management, project team, auditors | Problem, scope, stakeholders, functional and non-functional requirements, business rules, acceptance criteria |
| 03 | System Overview | Business users, testers | Module-by-module walkthrough in non-technical language |
| 04 | Access and Credentials | Project team and testers only | Addresses, sign-in, the live administrator account, test accounts, and what is handed over separately. **Confidential** |
| 05 | Tester Guide, Step by Step | The person doing the testing | One request carried through the whole system. 60 to 90 minutes |
| 06 | Client Testing Guide | Business testers | Setup then broader feature coverage. Companion to 05 |
| 07 | Procedure Compliance Matrix | Management, auditors | Clause-by-clause mapping to Central Procurement Procedure Rev 9.0 |
| 08 | Test Results | Management, project team | Evidence from the automated suites. 152 of 152 checks passed |

## Suggested use

- **For the CEO and investor conversation:** 01, with 07 and 08 as supporting evidence.
- **To brief the project team or agree scope:** 02.
- **To hand to a tester:** 05 first, then 06 for wider coverage, plus 04 for their logins.
- **For an auditor:** 07 and 08, with 02 for the control definitions.

## Note on document 04

It contains the live administrator credential and the test account credentials, and is
marked confidential. It deliberately excludes production secrets, which are handed over
separately.

The live administrator account uses the password `password`, which must be changed at
first sign-in. Until it is, this document is the most sensitive item in the pack. Do not
email it, and do not include it when sending the briefing to the CEO or an investor.

## Source files

| PDF | Source |
|---|---|
| 01 | `EXECUTIVE_BRIEFING.md` |
| 02 | `BUSINESS_REQUIREMENTS_DOCUMENT.md` |
| 03 | `SYSTEM_OVERVIEW.md` |
| 04 | `ACCESS_AND_CREDENTIALS.md` |
| 05 | `docs/TESTER_STEP_BY_STEP.md` |
| 06 | `CLIENT_TESTING_GUIDE.md` |
| 07 | `PROCEDURE_COMPLIANCE.md` |
| 08 | `SMOKE_TEST_RESULTS.md` |
