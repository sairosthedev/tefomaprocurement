import { getChecklistKeyForDocType } from '@fossil/shared';
import { Inventory, RFQ, Notification, SupplierProfile, User } from '../models/index.js';
import { notifyUsersByRole, notifySupplier, createNotification } from '../services/notification.service.js';
import { effectiveLevelExpr, isLowExpr, withLiveItem } from '../lib/stockLevels.js';
import { applyExpiryToKys, scanDocumentExpiry } from '../services/documentExpiry.service.js';
import { logger } from '../lib/logger.js';

const DEDUP_HOURS = parseInt(process.env.ALERT_DEDUP_HOURS || '24', 10);
const RFQ_DEADLINE_HOURS = parseInt(process.env.RFQ_DEADLINE_ALERT_HOURS || '48', 10);

function dedupSince(): Date {
  const d = new Date();
  d.setHours(d.getHours() - DEDUP_HOURS);
  return d;
}

async function wasEntityRecentlyAlerted(type: string, entity: string, entityId: unknown): Promise<boolean> {
  const existing = await Notification.exists({
    type,
    entity,
    entityId,
    createdAt: { $gte: dedupSince() }
  });
  return !!existing;
}

/**
 * One low-stock alert per site, to the stores officers who work there.
 *
 * It used to send one notification and email per item to every stores officer
 * and administrator, without saying which site, and it took the first 50 low
 * items before skipping those already alerted, so items past the 50th were
 * never alerted at all. Now each site gets one alert listing what is low, using
 * the same rule as the inventory page. An item is alerted once a day; within
 * the day only newly low items bring a fresh alert, so nothing is repeated.
 */
export async function runLowStockAlertJob(): Promise<number> {
  const bySite = await Inventory.aggregate([
    ...withLiveItem(),
    { $match: { $expr: isLowExpr } },
    { $lookup: { from: 'sites', localField: 'site', foreignField: '_id', as: 'siteDoc' } },
    { $unwind: { path: '$siteDoc', preserveNullAndEmptyArrays: true } },
    { $sort: { quantityOnHand: 1, 'itemDoc.name': 1 } },
    {
      $group: {
        _id: '$site',
        siteName: { $first: '$siteDoc.name' },
        items: {
          $push: {
            inventoryId: '$_id',
            name: '$itemDoc.name',
            code: '$itemDoc.code',
            unit: '$itemDoc.unit',
            onHand: '$quantityOnHand',
            level: effectiveLevelExpr
          }
        }
      }
    }
  ]);

  let sent = 0;
  for (const group of bySite) {
    if (!group._id) continue;
    const siteId = group._id;
    const siteName = group.siteName || 'a store';

    // Items already in an alert for this site today are not repeated.
    const recent = await Notification.find({
      type: 'low_stock',
      entity: 'Site',
      entityId: siteId,
      createdAt: { $gte: dedupSince() }
    })
      .select('metadata.inventoryIds')
      .lean();
    const alerted = new Set<string>(
      recent.flatMap((n: any) => (n.metadata?.inventoryIds || []).map((id: unknown) => String(id)))
    );
    const fresh = (group.items as any[]).filter((row) => !alerted.has(String(row.inventoryId)));
    if (fresh.length === 0) continue;

    const out = fresh.filter((row) => (row.onHand || 0) <= 0);
    const listed = fresh
      .slice(0, 5)
      .map((row) => `${row.name} ${row.onHand <= 0 ? 'out of stock' : `${row.onHand} ${row.unit || ''}`.trim()}`)
      .join('; ');
    const more = fresh.length > 5 ? `, and ${fresh.length - 5} more` : '';
    const headline = out.length > 0
      ? `${fresh.length} item${fresh.length === 1 ? '' : 's'} low at ${siteName}, ${out.length} out of stock`
      : `${fresh.length} item${fresh.length === 1 ? '' : 's'} low at ${siteName}`;

    // The site's own stores officers, and those with no home site who cover
    // every store. Administrators are no longer sent each site's list.
    const recipients = await User.find({
      role: 'stores_officer',
      status: 'active',
      isDeleted: false,
      $or: [{ homeSite: siteId }, { homeSite: null }, { homeSite: { $exists: false } }]
    }).select('_id');
    for (const recipient of recipients) {
      await createNotification({
        recipient: recipient._id,
        type: 'low_stock',
        title: out.length > 0 ? `Out of stock at ${siteName}` : `Low stock at ${siteName}`,
        message: `${headline}: ${listed}${more}. Restock from the inventory page.`,
        entity: 'Site',
        entityId: siteId,
        metadata: {
          siteName,
          count: fresh.length,
          outOfStock: out.length,
          inventoryIds: fresh.map((row) => row.inventoryId),
          items: fresh.slice(0, 20).map((row) => ({ name: row.name, code: row.code, onHand: row.onHand, reorderLevel: row.level }))
        }
      });
      sent++;
    }
  }

  if (sent > 0) {
    logger.info(`Low-stock alert job: ${sent} notification(s) across ${bySite.length} site(s)`);
  }

  return sent;
}

/**
 * Remind invited suppliers when an open RFQ deadline is within the configured window.
 */
export async function runRfqDeadlineAlertJob(): Promise<number> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + RFQ_DEADLINE_HOURS * 60 * 60 * 1000);

  const rfqs = await RFQ.find({
    isDeleted: false,
    status: 'open',
    submissionDeadline: { $gt: now, $lte: windowEnd }
  })
    .select('rfqNumber title submissionDeadline invitedSuppliers')
    .lean();

  let sent = 0;

  for (const rfq of rfqs) {
    const hoursLeft = Math.max(
      1,
      Math.round((new Date(rfq.submissionDeadline).getTime() - now.getTime()) / (60 * 60 * 1000))
    );

    for (const invite of rfq.invitedSuppliers || []) {
      if (invite.responded) continue;

      const supplierId = invite.supplier?._id || invite.supplier;
      if (!supplierId) continue;

      const profile = await SupplierProfile.findById(supplierId).select('user').lean();
      if (!profile?.user) continue;

      const alreadySent = await Notification.exists({
        type: 'rfq_deadline_approaching',
        entity: 'RFQ',
        entityId: rfq._id,
        recipient: profile.user,
        createdAt: { $gte: dedupSince() }
      });
      if (alreadySent) continue;

      await notifySupplier(supplierId, {
        type: 'rfq_deadline_approaching',
        title: 'RFQ deadline approaching',
        message: `RFQ ${rfq.rfqNumber} — "${rfq.title}" closes in about ${hoursLeft} hour(s). Submit your quotation before the deadline.`,
        entity: 'RFQ',
        entityId: rfq._id,
        metadata: {
          rfqNumber: rfq.rfqNumber,
          deadline: rfq.submissionDeadline,
          hoursLeft
        }
      });
      sent++;
    }
  }

  if (sent > 0) {
    logger.info(`RFQ deadline alert job: ${sent} notification(s) across ${rfqs.length} RFQ(s)`);
  }

  return sent;
}

/**
 * Warn on compliance documents nearing expiry, and apply the consequence when
 * they lapse.
 *
 * Follows the SAP Ariba pattern of notifying both before and after expiry, to
 * the supplier and to procurement. On lapse the checklist item unticks and
 * `kysComplete` drops, which the eligibility gate reads — so the supplier stops
 * being awardable for NEW work while existing POs continue untouched.
 */
export async function runDocumentExpiryAlertJob(): Promise<number> {
  const now = new Date();

  // Type and expiry only: the file bodies are stored inline and every
  // supplier with a dated document would otherwise be loaded in full. `tier`
  // is needed because completeness is judged against it — without it the
  // recompute below fell back to full depth and could fail a tactical supplier
  // on items their tier never required.
  const suppliers = await SupplierProfile.find({
    isDeleted: false,
    status: { $in: ['active', 'pending'] },
    'complianceDocuments.expiryDate': { $exists: true }
  }).select(
    'companyName user tier kysChecklist kysComplete expiredDocumentTypes hasExpiredDocuments ' +
      'complianceDocuments._id complianceDocuments.documentType complianceDocuments.expiryDate'
  );

  let sent = 0;

  for (const supplier of suppliers) {
    const { expiringSoon } = scanDocumentExpiry(supplier as any, now);

    // Upcoming expiry: remind while there is still time to re-certify.
    for (const { doc, daysLeft, window } of expiringSoon) {
      const alreadySent = await Notification.exists({
        type: 'supplier_document_expiring',
        entity: 'SupplierProfile',
        entityId: supplier._id,
        'metadata.documentType': doc.documentType,
        'metadata.window': window,
        createdAt: { $gte: dedupSince() }
      });
      if (alreadySent) continue;

      const message = `${doc.documentType.replace(/_/g, ' ')} for ${supplier.companyName} expires in ${daysLeft} day(s). Upload a current document to stay compliant.`;

      await notifySupplier(supplier._id, {
        type: 'supplier_document_expiring',
        title: 'Compliance document expiring',
        message,
        entity: 'SupplierProfile',
        entityId: supplier._id,
        metadata: { documentType: doc.documentType, daysLeft, window, expiryDate: doc.expiryDate }
      });
      await notifyUsersByRole(['procurement_officer', 'admin'], {
        type: 'supplier_document_expiring',
        title: 'Supplier document expiring',
        message,
        entity: 'SupplierProfile',
        entityId: supplier._id,
        metadata: { documentType: doc.documentType, daysLeft, window, expiryDate: doc.expiryDate }
      });
      sent += 2;
    }

    // Lapsed: untick the checklist and recompute KYS completeness.
    const { expiredTypes, newlyExpired, kysCompleteChanged } = applyExpiryToKys(supplier as any, now);
    if (newlyExpired.length > 0 || kysCompleteChanged) {
      // Write only the fields the expiry touched. The documents were loaded
      // without their files, so a full save() must never be allowed near them.
      const set: Record<string, unknown> = {
        expiredDocumentTypes: expiredTypes,
        hasExpiredDocuments: expiredTypes.length > 0,
        kysComplete: supplier.kysComplete
      };
      for (const documentType of expiredTypes) {
        const checklistKey = getChecklistKeyForDocType(documentType);
        if (checklistKey) set[`kysChecklist.${checklistKey}`] = false;
      }
      await SupplierProfile.updateOne({ _id: supplier._id }, { $set: set });
    }

    for (const documentType of newlyExpired) {
      const message = `${documentType.replace(/_/g, ' ')} for ${supplier.companyName} has expired.${kysCompleteChanged ? ' The supplier can no longer be awarded new work until it is replaced.' : ''}`;

      await notifySupplier(supplier._id, {
        type: 'supplier_document_expired',
        title: 'Compliance document expired',
        message,
        entity: 'SupplierProfile',
        entityId: supplier._id,
        metadata: { documentType, blocksNewAwards: kysCompleteChanged }
      });
      await notifyUsersByRole(['procurement_officer', 'admin'], {
        type: 'supplier_document_expired',
        title: 'Supplier document expired',
        message,
        entity: 'SupplierProfile',
        entityId: supplier._id,
        metadata: { documentType, blocksNewAwards: kysCompleteChanged }
      });
      sent += 2;
    }
  }

  if (sent > 0) {
    logger.info(`Document expiry job: ${sent} notification(s) across ${suppliers.length} supplier(s)`);
  }

  return sent;
}

/**
 * Surface suppliers whose periodic re-evaluation has fallen due. Previously
 * `nextEvaluationDue` was written but only ever read by screens someone had to
 * choose to open, so an overdue supplier kept transacting unnoticed.
 */
export async function runSupplierReevaluationAlertJob(): Promise<number> {
  const now = new Date();

  const due = await SupplierProfile.find({
    isDeleted: false,
    status: { $in: ['active', 'dormant'] },
    nextEvaluationDue: { $lte: now }
  })
    .select('companyName nextEvaluationDue lastEvaluationAt')
    .limit(100)
    .lean();

  let sent = 0;

  for (const supplier of due) {
    if (await wasEntityRecentlyAlerted('supplier_evaluation_due', 'SupplierProfile', supplier._id)) {
      continue;
    }

    const overdueDays = Math.max(
      0,
      Math.round((now.getTime() - new Date(supplier.nextEvaluationDue!).getTime()) / (24 * 60 * 60 * 1000))
    );

    await notifyUsersByRole(['procurement_officer', 'admin'], {
      type: 'supplier_evaluation_due',
      title: 'Supplier evaluation due',
      message: `${supplier.companyName} is due for re-evaluation${overdueDays > 0 ? ` (${overdueDays} day(s) overdue)` : ''}.`,
      entity: 'SupplierProfile',
      entityId: supplier._id,
      metadata: {
        nextEvaluationDue: supplier.nextEvaluationDue,
        lastEvaluationAt: supplier.lastEvaluationAt,
        overdueDays
      }
    });
    sent++;
  }

  if (sent > 0) {
    logger.info(`Supplier re-evaluation job: ${sent} notification(s) for ${due.length} supplier(s)`);
  }

  return sent;
}

export async function runAllAlertJobs(): Promise<void> {
  await runLowStockAlertJob();
  await runRfqDeadlineAlertJob();
  await runDocumentExpiryAlertJob();
  await runSupplierReevaluationAlertJob();
}
