import { Inventory, RFQ, Notification, SupplierProfile } from '../models/index.js';
import { notifyUsersByRole, notifySupplier } from '../services/notification.service.js';
import { applyExpiryToKys, scanDocumentExpiry } from '../services/documentExpiry.service.js';
import { logger } from '../lib/logger.js';

const DEDUP_HOURS = parseInt(process.env.ALERT_DEDUP_HOURS || '24', 10);
const RFQ_DEADLINE_HOURS = parseInt(process.env.RFQ_DEADLINE_ALERT_HOURS || '48', 10);
const DEFAULT_REORDER_THRESHOLD = parseInt(process.env.LOW_STOCK_DEFAULT_THRESHOLD || '5', 10);

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
 * Notify stores officers when on-hand quantity is at or below the item reorder level.
 */
export async function runLowStockAlertJob(): Promise<number> {
  const lowStockRows = await Inventory.aggregate([
    { $match: { isDeleted: false } },
    {
      $lookup: {
        from: 'items',
        localField: 'item',
        foreignField: '_id',
        as: 'itemDoc'
      }
    },
    { $unwind: '$itemDoc' },
    {
      $match: {
        'itemDoc.isDeleted': false,
        'itemDoc.status': 'active',
        $expr: {
          $lte: [
            '$quantityOnHand',
            {
              $cond: [
                { $gt: ['$itemDoc.reorderLevel', 0] },
                '$itemDoc.reorderLevel',
                DEFAULT_REORDER_THRESHOLD
              ]
            }
          ]
        }
      }
    },
    {
      $project: {
        _id: 1,
        quantityOnHand: 1,
        itemName: '$itemDoc.name',
        itemCode: '$itemDoc.code',
        reorderLevel: '$itemDoc.reorderLevel'
      }
    },
    { $limit: 50 }
  ]);

  let sent = 0;

  for (const row of lowStockRows) {
    const threshold =
      row.reorderLevel > 0 ? row.reorderLevel : DEFAULT_REORDER_THRESHOLD;

    if (await wasEntityRecentlyAlerted('low_stock', 'Inventory', row._id)) {
      continue;
    }

    const message = `${row.itemName} (${row.itemCode}) is low: ${row.quantityOnHand} on hand (reorder at ${threshold}).`;

    await notifyUsersByRole(['stores_officer', 'admin'], {
      type: 'low_stock',
      title: 'Low stock alert',
      message,
      entity: 'Inventory',
      entityId: row._id,
      metadata: {
        itemCode: row.itemCode,
        itemName: row.itemName,
        quantityOnHand: row.quantityOnHand,
        reorderLevel: threshold
      }
    });
    sent++;
  }

  if (sent > 0) {
    logger.info(`Low-stock alert job: ${sent} notification(s) for ${lowStockRows.length} item(s)`);
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

  const suppliers = await SupplierProfile.find({
    isDeleted: false,
    status: { $in: ['active', 'pending'] },
    'complianceDocuments.expiryDate': { $exists: true }
  }).select('companyName user complianceDocuments kysChecklist kysComplete expiredDocumentTypes hasExpiredDocuments');

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
    const { newlyExpired, kysCompleteChanged } = applyExpiryToKys(supplier as any, now);
    if (newlyExpired.length > 0 || kysCompleteChanged) {
      await supplier.save();
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
