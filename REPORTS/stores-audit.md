# Stores Module Audit — fossilProcure

Summary: concise feature→implementation mapping and gaps for the `stores`/procurement area.

## Implemented (evidence files)
- **Routes:** [api/src/routes/stores.route.ts](api/src/routes/stores.route.ts)
- **Controllers index:** [api/src/controllers/stores/index.ts](api/src/controllers/stores/index.ts)
- **GRV / Receiving:** receive flow: [api/src/controllers/stores/receiveGoods.controller.ts](api/src/controllers/stores/receiveGoods.controller.ts)
- **Issue / Store Requisitions:** [api/src/controllers/stores/issueStock.controller.ts](api/src/controllers/stores/issueStock.controller.ts)
- **Store Requisition model:** [api/src/models/StoreRequisition.model.ts](api/src/models/StoreRequisition.model.ts)
- **Store Transaction model:** [api/src/models/StoreTransaction.model.ts](api/src/models/StoreTransaction.model.ts)
- **Stock transfers:** controllers in [api/src/controllers/stores](api/src/controllers/stores/index.ts)
- **Procurement core models:** `PurchaseRequisition`, `RFQ`, `Quotation`, `PurchaseOrder` (see `api/src/models`)
- **Notifications & Audit:** notification service and `AuditLog` model used in controllers

## Partial / Limited
- **Multi-site basics:** inventory/site-scoped helpers exist (`findOrCreateInventory`) — no advanced multi-location/bin support ([api/src/lib/siteScope.ts](api/src/lib/siteScope.ts) referenced).
- **Quality handling:** basic `condition` handling in receive flow; no dedicated QC workflows or quarantine module.

## Missing / Not implemented (gaps)
- **Budget module / budget control:** no budget models or explicit validation at requisition/PO time.
- **Contract accounting & retentions:** only incidental references (`contractualAgreements` constant), no contract lifecycle module.
- **GL / accounting export:** no GL export or AP/AR export service found.
- **Mobile / barcode scanning / offline:** no mobile client, barcode scan endpoints, or offline sync support.
- **Lot / serial / batch tracking and expiry:** not present.
- **Bin locations / pick & pack / cycle counts:** not present.
- **Advanced BI / scheduled reporting / ledger integration:** limited dashboard controllers but no BI layer or scheduled exports.

## Prioritized recommendations
1. High: implement `gl-export` endpoint and budget checks at PO creation/finance approval.
2. High: add mobile-assisted receiving endpoint (simple barcode scan + `receiveGoods` wrapper).
3. Medium: add lot/serial fields to `Item`/`Inventory` and capture at receipt; add QC status.
4. Medium: add bin/location and reservation logic for pick/pack and cycle counts.
5. Low: contract management module and scheduled BI exports.

---
Report generated automatically from codebase scan on 2026-06-15.
