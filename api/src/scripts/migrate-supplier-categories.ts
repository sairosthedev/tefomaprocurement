/**
 * Migrate supplier `categories` from legacy free text to canonical codes.
 *
 * Supplier categories were typed by hand before the code taxonomy existed, so
 * RFQ auto-matching (which matches on codes) found almost nobody. This rewrites
 * each supplier's categories to the canonical codes their legacy values map to.
 *
 * Behaviour:
 *   - Values already canonical are kept untouched.
 *   - Legacy values are replaced by their mapped code(s); one value may expand
 *     to several codes.
 *   - Values with no safe mapping are LEFT IN PLACE and reported, so a supplier
 *     never silently loses their only category. Nothing is deleted.
 *
 * Dry run by default; pass --apply to write.
 *
 *   npx tsx src/scripts/migrate-supplier-categories.ts
 *   npx tsx src/scripts/migrate-supplier-categories.ts --apply
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import { isValidCategoryCode, mapLegacyCategory, getCategoryName } from '@fossil/shared';
import { SupplierProfile } from '../models/index.js';

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

  const suppliers = await SupplierProfile.find({
    isDeleted: { $ne: true },
    'categories.0': { $exists: true }
  }).select('companyName categories');

  let changed = 0;
  let alreadyCanonical = 0;
  let withLeftovers = 0;
  const unresolved = new Map<string, number>();
  const samples: { company: string; before: string; after: string }[] = [];

  for (const supplier of suppliers) {
    const original: string[] = supplier.categories || [];
    const canonical: string[] = [];
    const leftover: string[] = [];

    for (const value of original) {
      if (isValidCategoryCode(value)) {
        canonical.push(value);
        continue;
      }
      const mapped = mapLegacyCategory(value);
      if (mapped.length > 0) {
        canonical.push(...mapped);
      } else {
        // No safe mapping: keep the original so nothing is lost, and report it.
        leftover.push(value);
        unresolved.set(value, (unresolved.get(value) || 0) + 1);
      }
    }

    const next = Array.from(new Set([...canonical, ...leftover]));
    const isSame =
      next.length === original.length && next.every((c, i) => c === original[i]);

    // Count leftovers before the no-change guard: a supplier whose ONLY value
    // is unmappable (e.g. "SUBCONTRACTOR") comes out identical, and would
    // otherwise be reported as "already canonical" when it is the opposite.
    if (leftover.length > 0) withLeftovers++;

    if (isSame) {
      if (leftover.length === 0) alreadyCanonical++;
      continue;
    }

    changed++;

    if (samples.length < 15) {
      samples.push({
        company: supplier.companyName,
        before: original.join(' | '),
        after: next
          .map((c) => (isValidCategoryCode(c) ? `${c} (${getCategoryName(c)})` : `${c} [unmapped]`))
          .join(' | ')
      });
    }

    if (apply) {
      supplier.categories = next;
      await supplier.save();
    }
  }

  console.log(`Suppliers with categories:     ${suppliers.length}`);
  console.log(`  rewritten:                   ${changed}`);
  console.log(`  already canonical:           ${alreadyCanonical}`);
  console.log(`  still holding unmapped text: ${withLeftovers}\n`);

  if (samples.length > 0) {
    console.log('Sample rewrites:');
    for (const s of samples) {
      console.log(`\n  ${s.company}`);
      console.log(`    before: ${s.before}`);
      console.log(`    after:  ${s.after}`);
    }
  }

  if (unresolved.size > 0) {
    console.log(`\n\nValues with no safe mapping (${unresolved.size}) — kept as-is, need a human decision:`);
    [...unresolved.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([value, count]) => console.log(`  ${String(count).padStart(4)}  ${value}`));
  }

  if (!apply && changed > 0) {
    console.log('\nDry run only — re-run with --apply to write these values.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Migration failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
