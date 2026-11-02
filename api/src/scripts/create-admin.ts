/**
 * Create or update a single administrator account.
 *
 * Usage:
 *   npx tsx src/scripts/create-admin.ts <email> <password> <firstName> <lastName>
 *
 * If the account already exists the password and role are reset rather than
 * a duplicate being created. The password is hashed by the User model's
 * pre-save hook, so it is never stored in readable form.
 */
import '../config/loadEnv.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { User, Site } from '../models/index.js';

const [, , emailArg, passwordArg, firstNameArg, lastNameArg] = process.argv;

if (!emailArg || !passwordArg) {
  console.error(
    'Usage: tsx src/scripts/create-admin.ts <email> <password> [firstName] [lastName]'
  );
  process.exit(1);
}

const email = emailArg.toLowerCase().trim();
const password = passwordArg;
const firstName = firstNameArg || 'System';
const lastName = lastNameArg || 'Administrator';

if (password.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}

async function run(): Promise<void> {
  await connectDB();

  // Administrators are not tied to a department, but a home site keeps their
  // stores-facing screens working, so fall back to the HQ site if one exists.
  const hq = await Site.findOne({ type: 'hq' }).select('_id name');

  const existing = await User.findOne({ email }).select('+password');

  if (existing) {
    existing.password = password; // re-hashed by the pre-save hook
    existing.role = 'admin';
    existing.status = 'active';
    existing.firstName = firstName;
    existing.lastName = lastName;
    if (hq && !existing.homeSite) existing.homeSite = hq._id as any;
    existing.isDeleted = false;
    await existing.save();
    console.log(`Updated existing account to admin: ${email}`);
  } else {
    await User.create({
      email,
      password,
      firstName,
      lastName,
      role: 'admin',
      homeSite: hq?._id ?? null,
      status: 'active'
    });
    console.log(`Created admin account: ${email}`);
  }

  const check = await User.findOne({ email }).select(
    'email firstName lastName role status homeSite'
  );
  console.log('Result:', JSON.stringify(check, null, 2));

  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('Failed:', err?.message || err);
  try {
    await mongoose.connection.close();
  } catch {
    /* connection may never have opened */
  }
  process.exit(1);
});
