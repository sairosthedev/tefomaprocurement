# Tefoma Procurement — Step-by-Step Testing Guide

**For the person doing the testing. No technical knowledge needed.**

You will take one request through the whole system, from the person who needs a part
to the supplier getting paid. Follow the steps in order. Each step tells you what to
click, what to type, and **what you should see if it worked**.

Allow **60–90 minutes** for a full run.

---

## Before you start

### What you need

| You need | Notes |
|---|---|
| A computer with Chrome or Edge | Phone works but is harder |
| The system address | `https://tefomaprocurement.vercel.app` |
| Logins for each role | See the table in Step 0. Ask the project owner if you don't have them |
| Access to the email inbox for each login | Every sign-in sends a one-time code |
| This guide, printed or on a second screen | You'll be switching users a lot |

### The single most important thing to understand

You are **one person pretending to be seven different people**. The system deliberately
stops one person doing everything — the person who requests cannot approve, the person
who approves cannot pay. So you will **log out and log back in as someone else** many times.

> **Tip:** Use a normal window for one role and an Incognito/Private window for another.
> That way you can keep two people signed in at once and stop re-typing codes.
> (Chrome: `Ctrl+Shift+N`. Edge: `Ctrl+Shift+P`.)

### Signing in (you'll do this a lot)

1. Go to `https://tefomaprocurement.vercel.app`
2. Choose **Tefoma Staff** (or **Supplier Portal** for supplier steps).
3. Enter the email and password.
4. **A 6-digit code is emailed to that address.** Open the inbox, get the code, type it in.

If the code doesn't arrive, wait 30 seconds and check spam. The code expires — if you're
slow, just sign in again to get a fresh one.

---

## Step 0 — Write down your logins

Fill this in before you start. You'll be glad you did.

| Role | What they do in the test | Email | Password |
|---|---|---|---|
| End user | Raises the request | | |
| Department head (the requester's dept) | First approval | | |
| Stores officer | Checks stock, receives goods | | |
| Procurement officer | Runs the RFQ, raises the PO | | |
| Department head (Procurement) | Second approval | | |
| Finance | Third approval, pays | | |
| Supplier | Quotes, delivers, invoices | | |

> **Note:** COO is only needed for orders **over USD 5,000**. Our test order is small,
> so the COO step is skipped on purpose. See Step 8 if you want to test that too.

---

## The story you are testing

Keep this in your head — it makes every step make sense:

> A **JCB 3CX backhoe** at the **Mbudzi Interchange** site has a leaking hydraulic pump.
> The machine is down. The operator needs a **seal kit**, but nobody on site knows the
> part number. So they take a **photo of the machine's data plate** — the metal plate on
> the machine showing its serial number — and attach it to the request.
>
> The supplier doesn't have the genuine JCB part, but has an **equivalent** that fits.
> They must show us exactly what they'd send before we agree.

We also add **A4 paper** to the same request. This is deliberate: it proves that ordinary
office requests don't get cluttered with machine fields.

---

## STEP 1 — The operator raises the request

**Sign in as: End user**

1. In the left menu click **My Requisitions**.
2. Click the green **+ New Requisition** button (top right).
3. You are now on the **Internal Requisition** form.

Fill in the top of the form:

| Field | What to type |
|---|---|
| **Title** * | `Hydraulic pump seal kit - JCB 3CX (Mbudzi)` |
| **Description** | `Backhoe PL-014 is down with a leaking hydraulic pump. Data plate photographed as the part number is not known on site.` |
| **Work Order** | `WO-TEST-001` (or leave blank) |
| **Urgency** | Choose **High** |

### Item 1 — the machine part

In the **ITEM 1** box:

| Field | What to type |
|---|---|
| **Details** | `Hydraulic pump seal kit` |
| **Category** * | Click and choose **Motor Vehicle Spares, Tyres & Accessories** |
| **Package** | `Kit` |
| **Quantity** | `2` |
| **Unit** | `Each` |
| **Specification** | `OEM or approved equivalent` |

Now the new part. Below Specification there is a grey bar:

**`> Equipment details & photos (optional)`**

> **Watch this closely — this is the first thing to test.**
> The moment you choose the **Motor Vehicle Spares** category, this panel should
> **open by itself**. That's intended: the system recognises this is a machine part.

Click the bar if it isn't already open. You'll see ten boxes. **Fill in only what you'd
realistically know** — every one is optional:

| Box | Type this |
|---|---|
| Make | `JCB` |
| Model | `3CX Sitemaster` |
| Plant / fleet number | `FC-EX-014` |
| Registration number | `AEB 1234` |
| Chassis / VIN number | `JCB3CX4TXK2345678` |
| Engine number | `4TNV98-ENG778899` |
| Machine serial / PIN | `PIN-JCB3CX4TXK2345678` |
| Component serial | `PUMP-SN-0099821` |
| Part number (OEM) | *leave blank — we don't know it* |
| Hours / odometer | `7450` |

### Attach the data plate photo

1. Under **Photos for the supplier**, click **Add photo**.
2. Choose any photo from your computer. A photo of any machine plate is ideal;
   any picture will do for testing.
3. Once it appears, set the dropdown under it to **Data plate / serial plate**.
4. In the caption box type `Machine data plate, boom base`.

### Item 2 — the office item

1. Click **+ Add Item** (top right of the Items section).
2. In **ITEM 2**:

| Field | What to type |
|---|---|
| Details | `A4 Bond Paper` |
| Category * | Choose an office/stationery category |
| Package | `Ream` |
| Quantity | `5` |
| Unit | `Ream` |
| Specification | `80gsm white` |

> **Test this:** the **Equipment details & photos** panel on Item 2 should stay
> **closed**. Do not open it. This proves office requests stay simple.

### Submit

Click **Submit for Approval** (bottom right).

**✅ What you should see**
- A success message.
- The request appears in **My Requisitions**.
- Status reads **Pending HOD Approval**.
- Write down the number, e.g. `PR-2026-000xx` — you'll need it all the way through.

**❌ Tell us if**
- The equipment panel did **not** open by itself when you picked the vehicle-spares category.
- The photo wouldn't upload, or vanished after saving.
- You could not type continuously in any box (letters dropping out).
- The A4 paper line showed machine fields.

---

## STEP 2 — Check what the request looks like

Still signed in as the **End user**, click into the requisition you just made.

**✅ What you should see**

Under **Line Items**, the *Hydraulic pump seal kit* row should show all your machine
details as neat labelled lines:

```
Make: JCB    Model: 3CX Sitemaster
Plant / fleet number: FC-EX-014
Registration number: AEB 1234
Chassis / VIN number: JCB3CX4TXK2345678
Engine number: 4TNV98-ENG778899
Machine serial / PIN: PIN-JCB3CX4TXK2345678
Component serial: PUMP-SN-0099821
Hours / odometer: 7450
```

…with a small **photo thumbnail** underneath. Click the thumbnail — it should open
large enough to read.

Directly below, the **A4 Bond Paper** row should show **only** the description and
`80gsm white`. **No machine fields at all.**

**❌ Tell us if** any value you typed is missing, shows in the wrong place, or if the
paper line has machine fields on it.

---

## STEP 3 — Department head approves

**Sign out. Sign in as: Department head** (the requester's department)

1. Click **Approvals** (or **Requisitions**) in the left menu.
2. Find your `PR-2026-000xx` and open it.
3. Check you can see the machine details — the approver needs them to judge the request.
4. Click **Approve** and add a comment: `Approved — machine is down, parts required urgently.`

**✅ What you should see** — status changes to **Stores Review**.

> **Also worth testing:** create a second throwaway requisition and **Reject** it with a
> reason, to check rejection works and the requester is told why.

---

## STEP 4 — Stores checks the shelves

**Sign out. Sign in as: Stores officer**

1. Go to **Stores PR Review** (or **Requisitions**).
2. Open your requisition.
3. Stores decides: do we already have this in stock?
   - If yes → issue it from stock.
   - For our test → click **Forward to Procurement** (we're pretending it's not held).

**✅ What you should see** — the request moves on to procurement, and stores can see
the same machine details you entered.

> ⚠️ **Known issue to watch for.** If procurement starts an RFQ before stores has
> responded, the request skips this step entirely. If that happens, note it — we've
> already reported it, and it's useful to know whether it bothers your team in practice.

---

## STEP 5 — Procurement asks suppliers for prices

**Sign out. Sign in as: Procurement officer**

1. Go to **Requisitions**, open your request, and check the machine details are there.
2. Create an **RFQ** (Request for Quotation) from it.
3. Set a **submission deadline** a few days ahead.
4. **Invite at least 3 suppliers** if you can — the rules expect three quotes.
   (If fewer are available, that's fine; Step 7 covers the waiver.)
5. Publish it.

**✅ What you should see**
- An RFQ number, e.g. `RFQ-2026-000xx`.
- Opening the RFQ shows **the machine details and the data plate photo** carried over
  from the requisition.

**❌ Tell us if** the machine details or photo did **not** carry across. That's the whole
point of the feature — the supplier must get them.

---

## STEP 6 — The supplier quotes (the important one)

**Sign out. Sign in as: Supplier** — via **Supplier Portal**, not the staff login.

1. Click **My RFQs**. Your RFQ should be listed.
2. Open it.

**✅ First check — what the supplier can see**

The supplier should see the machine identification **and be able to open the data plate
photo and read it**. This is the entire purpose of the change: previously a supplier
received only the words "hydraulic pump seal kit" and had to phone the site to ask what
machine it was for.

3. Click **Submit Quote**.
4. For the **Hydraulic pump seal kit** line, enter a unit price, e.g. `145.50`.
5. For **A4 Bond Paper**, enter e.g. `6.25`.

### Offering an equivalent part

Under the seal kit line, tick:

**☑ I am offering an equivalent / alternative part for this line**

Two boxes appear:

| Box | Type this |
|---|---|
| What are you supplying? | `Donaldson equivalent seal kit (OEM-interchangeable)` |
| Its part number | `P552100-EQ` |

Then click **Add photo** and upload a picture — this represents the data plate of the
part the supplier would actually send.

6. Submit the quotation.

**✅ What you should see** — a quotation number, e.g. `QT-2026-000xx`, and it appears
under **My Quotations**.

**❌ Tell us if** the alternative tick-box is missing, or the photo won't attach.

---

## STEP 7 — Procurement compares and accepts

**Sign out. Sign in as: Procurement officer**

1. Go to **Quotations** and open the supplier's quote.

> **You may see "Bid is sealed".** This is **correct and deliberate** — quotes stay hidden
> until the deadline passes or you close the RFQ, so nobody can peek at prices early.
> Click **Close RFQ & Reveal Bids** to continue.

**✅ What you should see — the key screen**

On the seal kit line, an **amber warning box**:

```
Alternative offered — not the exact part requested
Donaldson equivalent seal kit (OEM-interchangeable)
Part number: P552100-EQ
```

…with the supplier's photo below it.

**This is what you're checking:** the buyer is warned they are not getting the exact part,
is told precisely what they *are* getting, and can see it — all before agreeing to buy.

### If fewer than 3 suppliers quoted

You'll see the request blocked with a note about needing three quotations. To proceed:

1. Choose a **waiver type** — e.g. *Insufficient quotations received*.
2. Type a reason in the box, e.g.
   `Only one supplier responded within the deadline.`
3. Click **Approve waiver**.

> **Test this box carefully.** Type a long sentence into the waiver reason. Every letter
> must appear. (This box had a fault where only the first letter registered — it has been
> fixed, and this step confirms the fix.)

4. Complete any remaining authorisation steps shown on screen, then **Accept** the quotation.

---

## STEP 8 — The purchase order and its approvals

**Still signed in as: Procurement officer**

1. From the accepted quotation, create the **Purchase Order**.
2. Fill in delivery address and expected date.
3. Submit it for approval.

Now the PO goes through **three people in order**. Sign in as each in turn:

| # | Who | Where they look | What they do |
|---|---|---|---|
| 1 | Department head (requester's dept) | Approvals | Approve |
| 2 | Department head (Procurement) | Approvals | Approve |
| 3 | Finance | Approvals | Approve |

**✅ What you should see**

Open the PO. There is an **Approval Status** panel with four boxes. After all three
approvals it should read:

```
1. Dept HOD          ✓ Approved
2. Procurement HOD   ✓ Approved
3. Finance Approval  ✓ Approved
4. COO Authorization   Not required (below USD 5,000)
```

and the PO status becomes **Approved**.

> **Testing the COO rule (optional but valuable).** Our test order is small, so COO is
> skipped. To test the threshold, run a second request with a quantity/price that pushes
> the total **over USD 5,000** — box 4 should then require COO approval, and the PO must
> not proceed until the COO signs off.

**❌ Tell us if** the PO reached Approved without all three approvals, or if approvals
were accepted out of order.

---

## STEP 9 — Supplier accepts the order

**Sign out. Sign in as: Supplier**

1. Go to **My Purchase Orders**.
2. Open the PO and **Acknowledge** it, with a note like
   `Acknowledged — equivalent seal kit in stock, 10 days delivery.`

**✅ What you should see** — the PO shows as acknowledged.

---

## STEP 10 — Goods arrive at the store

**Sign out. Sign in as: Stores officer**

1. Go to **Deliveries**.
2. **Receive** the goods against the PO. Fill in:

| Field | What to type |
|---|---|
| Delivery note number | `DN-001` |
| Delivery date | today |
| **Who delivered — name** | `J. Moyo` |
| ID / company | `63-1234567X22` |
| **Vehicle registration** | `ADZ 4471` |
| Contact number | `+263772000111` |
| Quantity received | the full quantity for both lines |

3. Save. A **GRV number** is created, e.g. `GRV-2026-000xx`.

### Print the GRV

Open the delivery and **print** the Goods Received Voucher. A PDF opens.

**✅ What you should see** — a branded Tefoma document showing the PO, supplier, items,
and **three signature blocks**: DELIVERED BY, RECEIVED BY, INSPECTED BY.
"Delivered by" should show J. Moyo with the vehicle registration.

> ⚠️ **Known issue — please confirm you see it too.**
> **INSPECTED BY will print as "—" (blank).** When a delivery arrives complete, the system
> accepts it automatically and never asks who inspected it. We have reported this. Please
> note whether your team considers this a problem, because a GRV normally needs to evidence
> who physically checked the goods.

Also check: the stock level for the received items should **increase** in **Inventory**.

---

## STEP 11 — Invoice and payment

**Sign out. Sign in as: Supplier**

1. Submit an **invoice** against the PO for the full amount.

**Sign out. Sign in as: Finance**

2. Go to **Invoices**, open it, and **Approve**.

> **You may be blocked** with a message about a *three-way match failure*. This is
> **correct** — the system is refusing to pay because the invoice, the order and the goods
> received don't line up exactly. Review the difference, then use the force-approve option
> with a reason. Note that this gets recorded.

3. Record the **payment** against the approved invoice.

**✅ What you should see** — invoice status **Paid**, balance **0.00**.

---

## STEP 12 — Check the trail

**Sign in as: Admin**

1. Go to **Audit Logs**.
2. You should find entries for the whole run — approvals, the GRV being printed, the
   invoice approval (marked as forced if you did that), and the payment.
3. Also check **Notifications** as a couple of the roles — people should have been told
   when something needed their attention.

---

## Your checklist

Tick as you go. Give this back to the project owner.

| # | Step | Worked? | Notes |
|---|---|---|---|
| 1 | Requisition created with machine details + photo | ☐ | |
| 2 | Equipment panel opened by itself for vehicle spares | ☐ | |
| 3 | A4 paper line stayed simple (no machine fields) | ☐ | |
| 4 | All machine details shown on the requisition | ☐ | |
| 5 | Department head approved | ☐ | |
| 6 | Stores forwarded to procurement | ☐ | |
| 7 | RFQ carried the details + photo across | ☐ | |
| 8 | Supplier could see and read the data plate | ☐ | |
| 9 | Supplier offered an equivalent + uploaded its photo | ☐ | |
| 10 | Buyer saw the amber "Alternative offered" warning | ☐ | |
| 11 | Waiver reason box accepted continuous typing | ☐ | |
| 12 | PO approved by all three in order | ☐ | |
| 13 | COO correctly not required (under $5,000) | ☐ | |
| 14 | Supplier acknowledged the PO | ☐ | |
| 15 | GRV created with who delivered + vehicle | ☐ | |
| 16 | GRV printed as a proper document | ☐ | |
| 17 | INSPECTED BY was blank (expected — confirm) | ☐ | |
| 18 | Stock increased after receipt | ☐ | |
| 19 | Invoice approved and payment recorded | ☐ | |
| 20 | Audit log shows the full trail | ☐ | |

---

## How to report a problem

Please include all five of these — it's the difference between a bug we can fix in an
hour and one that takes a week:

1. **Which role you were signed in as** (e.g. "Stores officer").
2. **Which step number** from this guide.
3. **What you expected** to happen.
4. **What actually happened** — the exact message on screen.
5. **A screenshot.** (Windows: `Windows key + Shift + S`.)

Also say whether it **stopped you completely** or was just confusing — that tells us how
urgently to fix it.

---

## Things that look like faults but are not

Don't report these — they are the system working as designed:

| What you see | Why it's correct |
|---|---|
| **"Bid is sealed"** on a quotation | Prices stay hidden until the RFQ closes, so nobody can peek |
| **Can't activate a supplier** — KYS incomplete | Suppliers must pass compliance checks first; an override needs a written reason |
| **"Three-way match failed"** on an invoice | Finance won't pay when invoice, order and goods received disagree |
| **COO step greyed out** | Only required above USD 5,000 |
| **"Access Denied"** | You're signed in as the wrong role for that page — that's the point |
| **A code is needed every sign-in** | Two-factor security, on purpose |

---

## Known issues already reported

You may hit these. Note them if you do, but they're already logged:

1. **INSPECTED BY is always blank on the printed GRV** *(medium)* — deliveries received in
   full auto-accept, so nobody is recorded as having inspected them.
2. **Stores can be bypassed** *(low)* — starting an RFQ while a request is still in stores
   review skips the stores check.
3. **Old test data in the system** *(low)* — suppliers with names starting `SPLIT-`,
   `SMOKE-` or `NEG-` are leftovers from earlier testing, not real vendors.
