/**
 * Stand down the demo data of one business profile, so a unit can be re-seeded
 * as something else without reading as both.
 *
 * Fossil was seeded as an office that buys ICT before it was seeded as the
 * contractor it actually is. Running the construction seed on top leaves it
 * holding both, which is confusing for whoever tests it and, worse, leaves ICT
 * suppliers matchable by category so they keep turning up on invitation lists.
 *
 * Nothing is deleted. Suppliers are set `dormant`, which is the status the
 * eligibility gate already excludes from invitation and award, and items are
 * set `discontinued`. Both are reversible by hand, the audit trail is intact,
 * and any requisition or RFQ that already references them still resolves.
 *
 *   npm run retire:demo -- --sbu FOSSIL --profile ict              # dry run
 *   npm run retire:demo -- --sbu FOSSIL --profile ict --confirm
 *
 * Dry run by default, printing exactly what it would touch.
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import { SupplierProfile, Item } from '../models/index.js';
import { useSbuFromArgs } from '../tenancy/scriptContext.js';
import { getSbu } from '../tenancy/sbuContext.js';
import { PROFILES } from './demoProfiles.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const profileKey = (arg('profile') || '').toLowerCase();
  const profile = PROFILES[profileKey];
  if (!profile) {
    throw new Error(
      `Pass --profile with one of: ${Object.keys(PROFILES).join(', ')}.`
    );
  }

  const confirm = process.argv.includes('--confirm');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  await useSbuFromArgs();
  const sbu = getSbu();
  if (!sbu) throw new Error('Pass --sbu CODE to say which business unit to work on.');

  console.log(`\nBusiness unit : ${sbu.code}`);
  console.log(`Database      : ${sbu.dbName}`);
  console.log(`Retiring      : ${profileKey} (${profile.label})`);
  console.log(confirm ? '\n*** WRITING — this changes records ***\n' : '\nDRY RUN — nothing will be changed\n');

  // Suppliers are matched on registration number, which the seed sets and which
  // is the identity the group reconciles suppliers by. Matching on company name
  // would catch a real supplier that happens to share a demo one's name.
  const regs = profile.suppliers.map((s) => s.reg);
  const suppliers = await SupplierProfile.find({
    registrationNumber: { $in: regs },
    isDeleted: { $ne: true }
  }).select('companyName registrationNumber status categories');

  console.log(`suppliers to set dormant (${suppliers.length} of ${regs.length} looked for):`);
  for (const s of suppliers) {
    const already = (s as any).status === 'dormant' ? '  (already dormant)' : '';
    console.log(
      `  ${String((s as any).companyName).padEnd(34)} ${String((s as any).registrationNumber).padEnd(16)} ` +
        `${(s as any).status}${already}`
    );
  }

  const codes = profile.items.map((i) => i.code);
  const items = await Item.find({
    code: { $in: codes },
    isDeleted: { $ne: true }
  }).select('code name status');

  console.log(`\nitems to discontinue (${items.length} of ${codes.length} looked for):`);
  for (const i of items) {
    console.log(`  ${String((i as any).code).padEnd(16)} ${String((i as any).name).padEnd(40)} ${(i as any).status}`);
  }

  if (!confirm) {
    console.log('\nDry run complete. Re-run with --confirm to apply.');
    await mongoose.disconnect();
    return;
  }

  const supplierResult = await SupplierProfile.updateMany(
    { registrationNumber: { $in: regs }, isDeleted: { $ne: true } },
    { $set: { status: 'dormant' } }
  );
  const itemResult = await Item.updateMany(
    { code: { $in: codes }, isDeleted: { $ne: true } },
    { $set: { status: 'discontinued' } }
  );

  console.log(`\n  suppliers set dormant      ${supplierResult.modifiedCount}`);
  console.log(`  items set discontinued     ${itemResult.modifiedCount}`);
  console.log('\nDormant suppliers are excluded from category matching, so they will stop');
  console.log('appearing on invitation lists. Nothing was deleted; set them back to active');
  console.log('if this was not what you wanted.\n');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('\nRetiring the demo profile failed:', error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
