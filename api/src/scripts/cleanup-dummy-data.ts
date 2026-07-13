/**
 * Remove pre-import dummy/test data, keeping:
 *   - admin users
 *   - everything imported from the legacy ERP dump (suppliers + their users,
 *     sites, departments) — identified by the import tag
 *   - the HQ site (referenced by admin accounts)
 *
 * Removes:
 *   - all transactional data (PRs, RFQs, quotations, POs, deliveries,
 *     invoices, payments, store txns, transfers, notifications, audit logs…)
 *   - dummy items + inventory
 *   - supplier profiles NOT from the dump import, and their user accounts
 *   - all other non-admin users (test staff, e2e/smoke suppliers)
 *   - dummy site "MC" and dummy departments "ICT"/"Stores"
 *
 * Then seeds the real PPE item catalog (41 items) from the dump.
 *
 * Run: npx tsx src/scripts/cleanup-dummy-data.ts --yes [path\to\droplet_backup.sql]
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

import {
  User, SupplierProfile, Item, Inventory, Site, Department,
  PurchaseRequisition, RFQ, Quotation, QuotationEvaluation, PurchaseOrder,
  Delivery, StoreTransaction, StoreRequisition, StockTransfer, AuditLog,
  Notification, Invoice, Payment, SupplierEvaluation, OtpChallenge,
  DepartmentBudget
} from '../models/index.js';

const IMPORT_TAG_RE = /imported:droplet_backup/;
const args = process.argv.slice(2);
const dumpPath =
  args.find((a) => !a.startsWith('--')) ??
  path.join(__dirname, '../../../droplet_backup.sql');

async function main(): Promise<void> {
  if (!args.includes('--yes')) {
    console.error('This permanently deletes all pre-import dummy data (keeps admins + imported legacy data).');
    console.error('Re-run with: npx tsx src/scripts/cleanup-dummy-data.ts --yes');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log(`Connected to database: ${mongoose.connection.name}\n`);

  // 1. Wipe transactional collections (all of it predates the legacy import)
  const wipe: { name: string; model: mongoose.Model<any> }[] = [
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
    { name: 'SupplierEvaluation', model: SupplierEvaluation },
    { name: 'Notification', model: Notification },
    { name: 'AuditLog', model: AuditLog },
    { name: 'OtpChallenge', model: OtpChallenge }
  ];
  console.log('Wiping transactional/dummy collections:');
  for (const { name, model } of wipe) {
    const { deletedCount } = await model.deleteMany({});
    if (deletedCount) console.log(`  ${name}: ${deletedCount} removed`);
  }

  // 2. Remove supplier profiles that did NOT come from the legacy import,
  //    along with their user accounts.
  const dummyProfiles = await SupplierProfile.find({ notes: { $not: IMPORT_TAG_RE } })
    .select('companyName user').lean();
  const dummyProfileUserIds = dummyProfiles.map((p) => p.user).filter(Boolean);
  const profileResult = await SupplierProfile.deleteMany({ notes: { $not: IMPORT_TAG_RE } });
  console.log(`\nDummy supplier profiles removed: ${profileResult.deletedCount}`);
  dummyProfiles.forEach((p) => console.log(`  - ${p.companyName}`));

  // 3. Remove all non-admin users except those linked to an imported profile.
  const importedUserIds = (
    await SupplierProfile.find({ notes: IMPORT_TAG_RE }).select('user').lean()
  ).map((p) => String(p.user));
  const keepIds = new Set(importedUserIds);
  const usersToDelete = await User.find({
    role: { $ne: 'admin' },
    _id: { $nin: [...keepIds].map((id) => new mongoose.Types.ObjectId(id)) }
  }).select('email role').lean();
  const userResult = await User.deleteMany({
    _id: { $in: usersToDelete.map((u) => u._id) }
  });
  console.log(`\nDummy users removed: ${userResult.deletedCount}`);
  usersToDelete.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
  void dummyProfileUserIds; // covered by the non-admin sweep above

  // 4. Dummy site McChlery (HQ is kept — admin accounts reference it)
  const siteResult = await Site.deleteMany({ code: 'MC' });
  console.log(`\nDummy sites removed: ${siteResult.deletedCount} (MC/McChlery)`);

  // 5. Dummy departments: ICT duplicates the imported INFORMATION TECHNOLOGY;
  //    Stores is not part of the real org. Procurement/Finance exist in the
  //    legacy org chart, so they stay.
  const deptResult = await Department.deleteMany({ name: { $in: ['ICT', 'Stores'] } });
  console.log(`Dummy departments removed: ${deptResult.deletedCount} (ICT, Stores)`);

  // 6. Seed the real PPE item catalog from the dump
  console.log('\nImporting PPE item catalog from dump...');
  const text = fs.readFileSync(dumpPath, 'utf8');
  const block = (table: string): string[][] => {
    const m = text.match(new RegExp(`COPY public\\.${table} \\([^)]+\\) FROM stdin;\\r?\\n([\\s\\S]*?)\\r?\\n\\\\\\.`));
    return m ? m[1].split(/\r?\n/).map((l) => l.split('\t')) : [];
  };
  const categories = new Map(block('ppematrix_ppecategory').map(([id, name]) => [id, name]));
  const itemTypes = block('ppematrix_ppeitemtype');

  let seq = 0;
  for (const [, name, description, sizeRequired, categoryId] of itemTypes) {
    seq += 1;
    const code = `PPE-${String(seq).padStart(4, '0')}`;
    const isPair = /glove|boot|sleeve|guard|chap|earplug|earmuff/i.test(name);
    await Item.create({
      code,
      name,
      description: description || undefined,
      category: categories.get(categoryId) ?? 'PPE',
      unit: isPair ? 'pair' : 'each',
      reorderLevel: 0,
      specifications: sizeRequired === 't' ? { sizing: 'size required (alpha)' } : undefined,
      status: 'active'
    });
  }
  console.log(`  Items created: ${seq}`);

  // Final state
  console.log('\n=== Final counts ===');
  const finals: [string, mongoose.Model<any>][] = [
    ['users', User], ['supplierprofiles', SupplierProfile], ['items', Item],
    ['sites', Site], ['departments', Department]
  ];
  for (const [label, model] of finals) {
    console.log(`  ${label}: ${await model.countDocuments()}`);
  }
  const admins = await User.find({ role: 'admin' }).select('email').lean();
  console.log(`  admins kept: ${admins.map((a) => a.email).join(', ')}`);

  await mongoose.disconnect();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
