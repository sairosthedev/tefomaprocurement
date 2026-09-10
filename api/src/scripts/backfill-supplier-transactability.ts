/**
 * One-time migration: backfill `transactability` on existing suppliers.
 *
 * WHY THIS IS REQUIRED BEFORE DEPLOY
 * ----------------------------------
 * `transactability` was added with a schema default of 'none', and the
 * eligibility gate refuses to award or raise a PO for anything that is not
 * 'spend_authorized'. Every supplier that already exists would therefore be
 * frozen the moment the new code ships. This script assigns the value that
 * matches each supplier's existing standing, so the new axis starts out
 * agreeing with reality instead of blocking it.
 *
 * Mapping (deliberately conservative — it never grants more than the old
 * rules already allowed):
 *   active   + (kysComplete || kysExempt)  -> spend_authorized
 *   active   + KYS incomplete              -> prospective  (may quote, not be awarded)
 *   pending                                -> prospective
 *   suspended / blacklisted / dormant      -> none
 *
 * Dry run by default; pass --apply to write.
 *
 *   npx tsx src/scripts/backfill-supplier-transactability.ts
 *   npx tsx src/scripts/backfill-supplier-transactability.ts --apply
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import { SupplierProfile } from '../models/index.js';

type Transactability = 'none' | 'prospective' | 'spend_authorized';

function targetFor(supplier: any): Transactability {
  if (supplier.status === 'active') {
    return supplier.kysComplete || supplier.kysExempt ? 'spend_authorized' : 'prospective';
  }
  if (supplier.status === 'pending') return 'prospective';
  return 'none';
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log(`Connected to: ${mongoose.connection.name}`);
  console.log(apply ? 'Mode: APPLY (writing changes)\n' : 'Mode: DRY RUN (no writes)\n');

  const suppliers = await SupplierProfile.find({ isDeleted: false }).select(
    'companyName status kysComplete kysExempt transactability'
  );

  const tally: Record<string, number> = {
    spend_authorized: 0,
    prospective: 0,
    none: 0,
    unchanged: 0
  };
  const changed: { companyName: string; status: string; from: string; to: string }[] = [];

  for (const supplier of suppliers) {
    const target = targetFor(supplier);
    const current = (supplier as any).transactability || 'none';

    if (current === target) {
      tally.unchanged++;
      continue;
    }

    changed.push({
      companyName: supplier.companyName,
      status: supplier.status,
      from: current,
      to: target
    });
    tally[target]++;

    if (apply) {
      (supplier as any).transactability = target;
      (supplier as any).transactabilityChangedAt = new Date();
      await supplier.save();
    }
  }

  console.log(`Suppliers scanned:   ${suppliers.length}`);
  console.log(`Already correct:     ${tally.unchanged}`);
  console.log(`-> spend_authorized: ${tally.spend_authorized}`);
  console.log(`-> prospective:      ${tally.prospective}`);
  console.log(`-> none:             ${tally.none}\n`);

  if (changed.length > 0) {
    console.table(changed.slice(0, 50));
    if (changed.length > 50) {
      console.log(`… and ${changed.length - 50} more`);
    }
  }

  if (!apply && changed.length > 0) {
    console.log('\nDry run only — re-run with --apply to write these values.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Backfill failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
