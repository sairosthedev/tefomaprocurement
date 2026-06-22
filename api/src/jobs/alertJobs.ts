import { Inventory, RFQ, Notification, SupplierProfile } from '../models/index.js';
import { notifyUsersByRole, notifySupplier } from '../services/notification.service.js';
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

export async function runAllAlertJobs(): Promise<void> {
  await runLowStockAlertJob();
  await runRfqDeadlineAlertJob();
}
