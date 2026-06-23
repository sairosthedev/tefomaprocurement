/**
 * Wipe supplier registry and all transactional data on the connected database.
 * Keeps: admin users, sites, departments.
 *
 * Usage:
 *   npx tsx src/scripts/reset-transactional-data.ts --yes
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

import {
  SupplierProfile,
  Item,
  Inventory,
  PurchaseRequisition,
  RFQ,
  Quotation,
  QuotationEvaluation,
  PurchaseOrder,
  Delivery,
  StoreTransaction,
  StoreRequisition,
  StockTransfer,
  AuditLog,
  Notification,
  Invoice,
  Payment,
  SupplierEvaluation,
  OtpChallenge,
  DepartmentBudget,
  User
} from '../models/index.js';

const COLLECTIONS_TO_WIPE: { name: string; model: mongoose.Model<any> }[] = [
  { name: 'SupplierProfile', model: SupplierProfile },
  { name: 'SupplierEvaluation', model: SupplierEvaluation },
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
  { name: 'Inventory', model: Inventory },
  { name: 'Item', model: Item },
  { name: 'DepartmentBudget', model: DepartmentBudget },
  { name: 'Notification', model: Notification },
  { name: 'AuditLog', model: AuditLog },
  { name: 'OtpChallenge', model: OtpChallenge }
];

async function main(): Promise<void> {
  if (!process.argv.includes('--yes')) {
    console.error('This permanently deletes suppliers and all transactional data.');
    console.error('Re-run with: npx tsx src/scripts/reset-transactional-data.ts --yes');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const dbName = mongoose.connection.name;
  console.log(`Connected to database: ${dbName}\n`);

  const adminCount = await User.countDocuments({ role: 'admin' });
  const nonAdminCount = await User.countDocuments({ role: { $ne: 'admin' } });
  console.log(`Users kept: ${adminCount} admin(s), ${nonAdminCount} non-admin(s) (unchanged)\n`);

  let total = 0;
  for (const { name, model } of COLLECTIONS_TO_WIPE) {
    const { deletedCount } = await model.deleteMany({});
    console.log(`  ${name}: ${deletedCount} removed`);
    total += deletedCount ?? 0;
  }

  console.log(`\nTotal documents removed: ${total}`);
  console.log('Kept: User (admins), Site, Department');
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
