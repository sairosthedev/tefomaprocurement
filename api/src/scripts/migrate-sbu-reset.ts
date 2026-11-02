/**
 * Section 14 of the multi-entity plan: prepare an SBU's database for go-live.
 *
 * Fossil's database becomes the FOSSIL SBU database as it stands — nothing is
 * copied anywhere, because SBUs are fully separate (D5–D7). What this does is
 * clear the transactions (D9) while keeping everything that is not a
 * transaction, so the business unit starts clean without losing its master
 * data.
 *
 *   Deleted   requisitions, RFQs, quotations, evaluations, purchase orders,
 *             deliveries, invoices, payments, store requisitions and
 *             transactions, stock transfers, supplier evaluations, and the
 *             notifications that pointed at them
 *   Kept      users, suppliers, items, sites, departments, budgets, inventory,
 *             and the whole audit log, as history
 *   Rewritten inventory balances, as one opening-balance stock transaction per
 *             item and site, so the ledger reconciles against the quantities
 *             that remain
 *
 * Budgets need no treatment: spend is derived from transactions rather than
 * stored, so deleting the transactions zeroes it.
 *
 *   npm run migrate:sbu-reset -- --sbu FOSSIL                 # dry run
 *   npm run migrate:sbu-reset -- --sbu FOSSIL --confirm
 *
 * Dry run by default, and it prints every count it would delete and create.
 * Rehearse it on a restored copy before pointing it at anything real.
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import {
  PurchaseRequisition,
  RFQ,
  Quotation,
  QuotationEvaluation,
  PurchaseOrder,
  Delivery,
  Invoice,
  Payment,
  StoreRequisition,
  StoreTransaction,
  StockTransfer,
  SupplierEvaluation,
  Notification,
  Inventory,
  User
} from '../models/index.js';
import { useSbuFromArgs } from '../tenancy/scriptContext.js';
import { getSbu } from '../tenancy/sbuContext.js';
import { getAppEnv } from '../config/env.js';

/**
 * Everything that represents a transaction, and so goes.
 *
 * Annotated as Model<any> rather than inferred with `as const`: a readonly
 * tuple of twelve distinct Mongoose model types is enough to exhaust the type
 * checker's heap. resetTransactions.controller.ts does the same for the same
 * reason.
 */
const TRANSACTIONAL: { name: string; model: mongoose.Model<any> }[] = [
  { name: 'PurchaseRequisition', model: PurchaseRequisition },
  { name: 'RFQ', model: RFQ },
  { name: 'Quotation', model: Quotation },
  { name: 'QuotationEvaluation', model: QuotationEvaluation },
  { name: 'PurchaseOrder', model: PurchaseOrder },
  { name: 'Delivery', model: Delivery },
  { name: 'Invoice', model: Invoice },
  { name: 'Payment', model: Payment },
  { name: 'StoreRequisition', model: StoreRequisition },
  { name: 'StoreTransaction', model: StoreTransaction },
  { name: 'StockTransfer', model: StockTransfer },
  { name: 'SupplierEvaluation', model: SupplierEvaluation }
];

/** Notifications about these are meaningless once the records are gone. */
const TRANSACTIONAL_ENTITIES = TRANSACTIONAL.map((t) => t.name);

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm');
  const productionAck = process.argv.includes('--i-know-this-is-production');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  await useSbuFromArgs();
  const sbu = getSbu();
  if (!sbu) {
    throw new Error('No SBU resolved. Pass --sbu CODE, or set MONGODB_URI to the target database.');
  }

  const appEnv = getAppEnv();

  // Deleting live procurement history is not something to do by accident, and
  // --confirm alone is too easy to carry over from a rehearsal on a copy.
  if (appEnv === 'production' && confirm && !productionAck) {
    throw new Error(
      'This would delete transactions from PRODUCTION. Re-run with ' +
        '--i-know-this-is-production if that is genuinely what you mean.'
    );
  }

  console.log(`\nBusiness unit : ${sbu.code}`);
  console.log(`Database      : ${sbu.dbName}`);
  console.log(`Environment   : ${appEnv}`);
  console.log(confirm ? '\n*** WRITING — this deletes records ***\n' : '\nDRY RUN — nothing will be changed\n');

  // Counts first: the report is the point of the dry run.
  let totalToDelete = 0;
  console.log('  To delete');
  for (const { name, model } of TRANSACTIONAL) {
    const count = await model.countDocuments({});
    totalToDelete += count;
    if (count > 0) console.log(`    ${name.padEnd(22)} ${String(count).padStart(7)}`);
  }

  const notificationCount = await Notification.countDocuments({
    entity: { $in: TRANSACTIONAL_ENTITIES }
  });
  totalToDelete += notificationCount;
  if (notificationCount > 0) {
    console.log(`    ${'Notification'.padEnd(22)} ${String(notificationCount).padStart(7)}  (about the above only)`);
  }
  if (totalToDelete === 0) console.log('    nothing — already clean');

  // The inventory snapshot has to be taken before the store transactions go,
  // because the opening balances are rebuilt from the quantities that remain.
  const stock = await Inventory.find({
    isDeleted: { $ne: true },
    quantityOnHand: { $gt: 0 }
  })
    .select('item site quantityOnHand unitCost')
    .lean<Array<{ _id: any; item: any; site: any; quantityOnHand: number; unitCost?: number }>>();

  console.log('\n  To keep');
  for (const [label, model] of [
    ['User', User],
    ['Inventory', Inventory]
  ] as const) {
    console.log(`    ${label.padEnd(22)} ${String(await model.countDocuments({})).padStart(7)}`);
  }
  console.log(`    ${'(audit log, suppliers, items, sites, departments, budgets)'}`);

  console.log(`\n  To create`);
  console.log(`    ${'Opening balances'.padEnd(22)} ${String(stock.length).padStart(7)}  (one per item and site holding stock)`);

  if (!confirm) {
    console.log('\nDry run complete. Re-run with --confirm to apply.');
    await mongoose.disconnect();
    return;
  }

  // An opening balance needs an author. Whoever runs the migration is not in
  // the database, so it is attributed to an administrator of this SBU.
  const actor = await User.findOne({ role: 'admin', isDeleted: { $ne: true } }).select('_id').lean<{ _id: any } | null>();
  if (!actor && stock.length > 0) {
    throw new Error(
      `${sbu.code} has no administrator to attribute the opening balances to. ` +
        'Run bootstrap:sbus for this SBU first.'
    );
  }

  console.log('\n  Deleting');
  for (const { name, model } of TRANSACTIONAL) {
    const { deletedCount } = await model.deleteMany({});
    if (deletedCount) console.log(`    ${name.padEnd(22)} ${String(deletedCount).padStart(7)}`);
  }
  const removedNotifications = await Notification.deleteMany({
    entity: { $in: TRANSACTIONAL_ENTITIES }
  });
  if (removedNotifications.deletedCount) {
    console.log(`    ${'Notification'.padEnd(22)} ${String(removedNotifications.deletedCount).padStart(7)}`);
  }

  if (stock.length > 0) {
    console.log('\n  Writing opening balances');
    let written = 0;
    for (const row of stock) {
      // Created one at a time rather than with insertMany: the numbering hook
      // runs on save, and the counter is what keeps the numbers unique.
      await StoreTransaction.create({
        type: 'adjustment',
        item: row.item,
        site: row.site,
        inventory: row._id,
        quantity: row.quantityOnHand,
        previousQuantity: 0,
        newQuantity: row.quantityOnHand,
        unitCost: row.unitCost ?? 0,
        totalValue: (row.unitCost ?? 0) * row.quantityOnHand,
        reference: { type: 'adjustment' },
        reason: 'Opening balance carried forward at multi-entity migration',
        performedBy: actor!._id,
        notes: `Stock on hand when ${sbu.code} moved to its own database.`
      });
      written += 1;
    }
    console.log(`    ${String(written).padStart(7)} written`);
  }

  console.log(`\n${sbu.code} is ready. Run seed:counters next so numbering continues above what remains.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('\nMigration failed:', error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
