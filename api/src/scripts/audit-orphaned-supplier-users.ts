/**
 * READ-ONLY audit: supplier Users with no SupplierProfile.
 *
 * bulkImportSuppliers wrote `status: 'approved'`, which is not in the
 * SupplierProfile status enum. Each row therefore created its User first and
 * then failed profile validation, leaving an orphaned supplier login behind.
 * This script only counts and reports them — it deletes nothing.
 *
 *   npx tsx src/scripts/audit-orphaned-supplier-users.ts
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
import { User, SupplierProfile } from '../models/index.js';

config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function main() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const dbName = mongoose.connection.db?.databaseName;
  console.log(`Connected to: ${dbName}\n`);

  const supplierUsers = await User.find({ role: 'supplier' })
    .select('_id email firstName lastName createdAt isDeleted')
    .sort({ createdAt: 1 })
    .lean();

  const profiles = await SupplierProfile.find({})
    .select('user companyName isDeleted')
    .lean();

  const usersWithProfile = new Set(profiles.map((p: any) => String(p.user)));
  const orphans = supplierUsers.filter((u: any) => !usersWithProfile.has(String(u._id)));

  console.log(`Supplier users:      ${supplierUsers.length}`);
  console.log(`Supplier profiles:   ${profiles.length}`);
  console.log(`Orphaned users:      ${orphans.length}\n`);

  if (orphans.length > 0) {
    console.log('Orphaned supplier users (User row, no SupplierProfile):');
    console.table(
      orphans.map((u: any) => ({
        id: String(u._id),
        email: u.email,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        created: u.createdAt?.toISOString?.().slice(0, 10),
        softDeleted: Boolean(u.isDeleted)
      }))
    );
    console.log(
      '\nThese can still log in. Review before deciding to delete or attach a profile.'
    );
  }

  // A profile whose user is missing is the mirror-image inconsistency.
  const userIds = new Set(supplierUsers.map((u: any) => String(u._id)));
  const danglingProfiles = profiles.filter((p: any) => p.user && !userIds.has(String(p.user)));
  if (danglingProfiles.length > 0) {
    console.log(`\nProfiles referencing a missing/non-supplier user: ${danglingProfiles.length}`);
    console.table(
      danglingProfiles.map((p: any) => ({
        companyName: p.companyName,
        user: String(p.user)
      }))
    );
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Audit failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
