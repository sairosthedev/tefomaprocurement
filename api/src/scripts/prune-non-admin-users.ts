/**
 * One-off maintenance: delete all non-admin users and ensure a new admin exists.
 *
 * Usage (from api/):
 *   NEW_ADMIN_EMAIL=kudzai@example.com NEW_ADMIN_PASSWORD=secret npx tsx src/scripts/prune-non-admin-users.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { User, Site } from '../models/index.js';

async function main(): Promise<void> {
  const email = process.env.NEW_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.NEW_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Set NEW_ADMIN_EMAIL and NEW_ADMIN_PASSWORD environment variables.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set in api/.env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const before = await User.find().select('email role status isDeleted').lean();
  console.log(`Users before: ${before.length}`);
  before.forEach((u) => console.log(`  - ${u.email} (${u.role})`));

  const deleteResult = await User.deleteMany({ role: { $ne: 'admin' } });
  console.log(`\nDeleted ${deleteResult.deletedCount} non-admin user(s)`);

  const remainingAdmins = await User.find({ role: 'admin' }).select('email').lean();
  console.log(`Remaining admin accounts: ${remainingAdmins.map((u) => u.email).join(', ') || '(none)'}`);

  let hq = await Site.findOne({ code: 'HQ', isDeleted: false });
  if (!hq) {
    hq = await Site.create({
      code: 'HQ',
      name: 'Head Office Stores',
      type: 'hq',
      hasLocalStore: true,
      status: 'active'
    });
    console.log('Created HQ site');
  }

  let kudzai = await User.findOne({ email }).select('+password');
  if (kudzai) {
    kudzai.role = 'admin';
    kudzai.status = 'active';
    kudzai.isDeleted = false;
    kudzai.password = password;
    kudzai.firstName = kudzai.firstName || 'Kudzai';
    kudzai.lastName = kudzai.lastName || 'Admin';
    if (!kudzai.homeSite) kudzai.homeSite = hq._id;
    await kudzai.save();
    console.log(`\nUpdated existing user as admin: ${email}`);
  } else {
    kudzai = await User.create({
      email,
      password,
      firstName: 'Kudzai',
      lastName: 'Admin',
      role: 'admin',
      homeSite: hq._id,
      status: 'active'
    });
    console.log(`\nCreated admin user: ${email}`);
  }

  const after = await User.find().select('email role').lean();
  console.log(`\nUsers after: ${after.length}`);
  after.forEach((u) => console.log(`  - ${u.email} (${u.role})`));

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
