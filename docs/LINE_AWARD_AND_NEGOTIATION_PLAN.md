# Plan: Per-line award (multi-supplier / multi-PO), unquoted-goods handling, and price negotiation

## Problem being solved

1. **Negotiation** — procurement officer needs to push a supplier for a better price. Today a submitted quotation is locked and can only be accepted or rejected; there is no revision/negotiation path.
2. **Split award** — one RFQ has many line items; Supplier 1 quotes items A+B, Supplier 2 quotes item C. Today a PO is built from ONE whole accepted quotation, so cross-supplier line awarding is impossible.
3. **Unquoted goods** — after bidding closes some RFQ lines may have zero quotes. Today these are silently lost: the requisition flips to `ordered` on the first PO and nothing tracks or re-sources the gap.

Scenarios 2 and 3 share one root change: the system must award **per RFQ line**, not per whole quotation.

## Chosen approach

- **Negotiation:** "Request price revision" (supplier-confirmed round trip, versioned, auditable). Best PRAZ fit — the supplier confirms the new price rather than procurement editing a bid.
- **Line awarding:** Full per-line award → **one PO per winning supplier** from a single RFQ, with **unquoted/unawarded line tracking** and a **re-RFQ for leftovers**.

---

## Phase 0 — Stable RFQ line identity (foundation)

Per-line award needs each RFQ line to have a durable id.

- Add `lineId` (ObjectId, auto) to `RFQItemSchema`; expose it on the RFQ payload.
- When a supplier quotes, tag each quotation item with the `rfqLineId` it answers (fall back to description match for legacy quotes).
- **Files:** `RFQ.model.ts`, `Quotation.model.ts`, `submitQuotation.controller.ts`, supplier quote UI (`SubmitQuotation` page).
- **Back-compat:** existing quotes without `rfqLineId` still match by description; nothing breaks.

## Phase 1 — Negotiation (Request price revision)

- **Quotation model:** add `revisionOf` (link to prior version), `revisionRound` (int), and a `revisionRequests[]` log `{ requestedBy, reason, targetNote, requestedAt }`. Keep prior version as a locked historical record.
- **New endpoint:** `PUT /procurement/quotations/:id/request-revision` (procurement officer / proc head). Marks the quote `revision_requested`, notifies the supplier, unlocks a resubmission slot.
- **Supplier side:** the invited supplier sees "Revision requested — resubmit" and submits a new quotation linked via `revisionOf`; the old one is archived (`status: superseded`).
- **Status enum:** add `revision_requested` and `superseded` to the quotation status enum.
- **UI:** on `QuotationDetail`, add a "Request price revision" action with a reason + optional target price note; show revision history.
- **Files:** `Quotation.model.ts`, new `requestQuotationRevision.controller.ts`, `submitQuotation.controller.ts` (handle `revisionOf`), `QuotationDetail.tsx`, supplier `MyRFQs`/`SubmitQuotation`.

## Phase 2 — Per-line award model

- **New concept: RFQ award map.** On the RFQ, add `lineAwards[]`:
  `{ rfqLineId, awardedQuotation, awardedSupplier, awardedUnitPrice, quantity, status: 'awarded' | 'unquoted' | 'unawarded', hodSelection{by,justification,at}, pmAuthorization{by,at} }`.
- **Award is per line**, but the existing two-key control is preserved **per line**: HOD selects the winning supplier for each line (with justification), Procurement Manager authorizes. `quotationFullyAuthorized` becomes line-aware.
- **Compliance:** the min-3-quotes / waiver rule is evaluated **per line** (a line with <3 quotes needs a waiver, matching current behaviour but scoped to the line).
- **Files:** `RFQ.model.ts`, `quotationCompliance.service.ts`, `hodSelectQuotation.controller.ts`, `authorizeQuotation.controller.ts`, `acceptQuotation.controller.ts` (or new award controllers).

## Phase 3 — Multi-PO generation from the award map

- **New endpoint:** `POST /procurement/rfqs/:id/generate-pos` — groups awarded lines by supplier and creates **one PO per supplier**, each carrying only that supplier's awarded lines at the awarded prices.
- Each PO enters the normal approval chain (dept HOD → proc HOD → finance → COO) independently.
- **Requisition fulfilment:** track per requisition line how much is `ordered` across the generated POs; only mark the requisition `ordered`/`completed` when **all** lines are covered (not on first PO).
- Keep the existing single-quote `createPurchaseOrder` for the simple/whole-quote case (back-compat); the new endpoint is the split-award path.
- **Files:** new `generatePurchaseOrders.controller.ts`, `createPurchaseOrder.controller.ts` (shared helpers), `PurchaseRequisition.model.ts` (per-line ordered qty), requisition status logic.

## Phase 4 — Unquoted / unawarded goods handling

- After award, compute lines with **zero quotes** (`unquoted`) or **quoted but not awarded** (`unawarded`).
- Surface them on the RFQ detail as an "Unresolved lines" panel.
- **New endpoint:** `POST /procurement/rfqs/:id/resource` — spins up a **new RFQ** containing only the unresolved lines (linked back to the original requisition), so nothing is lost.
- Requisition is only `completed` once every line is either ordered or explicitly cancelled/closed.
- **Files:** award controllers (compute status), `resourceRfq.controller.ts`, RFQ detail UI.

## Phase 5 — UI: line-award comparison grid

- On the RFQ/quotation review screen, build a **matrix**: rows = RFQ lines, columns = suppliers, cells = quoted unit price (blank = not quoted). Officer picks the winning supplier per line; unquoted lines are flagged. Actions: request revision (per supplier), award line, generate POs, re-source leftovers.
- **Files:** new `AwardMatrix` component, `QuotationDetail.tsx` / a new `RfqAward.tsx` page.

---

## Sequencing & delivery

Ship in vertical slices, each deployed and verified before the next:

1. **Phase 1 (Negotiation)** — smallest, independent, immediately useful. Deliver first.
2. **Phase 0 + 2 + 3** — the line-award core (foundation → award → multi-PO). The big one.
3. **Phase 4** — unquoted/re-source handling.
4. **Phase 5** — the award-matrix UI polish (can overlap 2–4).

## Back-compatibility & risk

- All new fields are additive; legacy quotes/POs keep working (description-match fallback, whole-quote PO path retained).
- The two-key HOD/PM control and the min-3/waiver rule are preserved — just evaluated per line.
- In-flight RFQs/POs are unaffected; the new paths are opt-in per RFQ.
- Each phase is independently deployable and testable against production with tagged smoke data.

## Open questions to confirm before building

1. Negotiation: should "request revision" be allowed **after** RFQ close (common in practice) or only while open? (Recommend: allow after close, before award.)
2. Re-sourced RFQ: auto-invite the same suppliers, or let the officer choose? (Recommend: pre-fill same invitees, editable.)
3. Min-3/waiver per line: confirm the waiver is **per line** (a single-source line needs its own waiver), not per RFQ.
