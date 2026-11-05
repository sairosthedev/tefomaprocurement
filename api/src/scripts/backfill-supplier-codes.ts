/**
 * Give every supplier that has none its permanent supplier code.
 *
 * New suppliers get a code when first saved (SupplierProfile's pre('validate')
 * hook), e.g. `DOKUMA-SUP-00042`. Suppliers that existed before codes did get
 * theirs here, oldest first, from the same `supplier:0` counter the hook uses,
 * so codes issued afterwards carry on the sequence.
 *
 * Safe to re-run: a supplier that has a code is never given another. Before
 * assigning, the counter is raised to the highest code already on file, so a
 * database restored or copied without its counters cannot reissue a code.
 *
 * Written with updateOne rather than save(): a legacy record that fails some
 * unrelated validation still gets its code, and `updatedAt` is left alone (the
 * retention review reads it as "last touched").
 *
 * Dry run by default; pass --apply to write.
 *
 *   npm run backfill:supplier-codes -w api -- --sbu DOKUMA
 *   npm run backfill:supplier-codes -w api -- --sbu DOKUMA --apply
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import { SupplierProfile } from '../models/index.js';
import {
  SUPPLIER_CODE_COUNTER,
  SUPPLIER_CODE_PATTERN,
  nextSupplierCode
} from '../models/SupplierProfile.model.js';
import { counterKey, sbuNumberPrefix } from '../services/numbering.service.js';
import { useSbuFromArgs } from '../tenancy/scriptContext.js';
import { connectionForSbu } from '../tenancy/connections.js';
import { getSbu } from '../tenancy/sbuContext.js';

const NO_CODE = { $or: [{ supplierCode: { $exists: false } }, { supplierCode: null }, { supplierCode: '' }] };

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  // Codes lead with the SBU's own code, so the business unit must be named:
  // without it they would be issued with no prefix at all.
  await useSbuFromArgs();
  const sbu = getSbu();
  if (!sbu) throw new Error('Pass --sbu CODE to say which business unit to work on.');

  const Counter = connectionForSbu(sbu).model('Counter');
  const key = counterKey(SUPPLIER_CODE_COUNTER.type, SUPPLIER_CODE_COUNTER.year);

  console.log(`\nBusiness unit : ${sbu.code}`);
  console.log(`Database      : ${sbu.dbName}`);
  console.log(apply ? 'Mode          : APPLY (writing changes)\n' : 'Mode          : DRY RUN (no writes)\n');

  // Soft-deleted records are included: a code identifies the record for good,
  // and one restored later should not arrive without it.
  const [coded, uncoded, counter] = await Promise.all([
    SupplierProfile.find({ supplierCode: { $nin: [null, ''] } }).select('supplierCode').lean(),
    SupplierProfile.find(NO_CODE).select('_id companyName status createdAt isDeleted').sort({ createdAt: 1, _id: 1 }),
    Counter.findById(key).lean<{ seq: number } | null>()
  ]);

  let highest = 0;
  let unparsed = 0;
  for (const row of coded as Array<{ supplierCode?: string }>) {
    const match = SUPPLIER_CODE_PATTERN.exec(String(row.supplierCode || '').trim());
    if (match) highest = Math.max(highest, Number(match[1]));
    else unparsed += 1;
  }
  const counterAt = counter?.seq ?? 0;

  console.log(`Suppliers with a code    : ${coded.length}${unparsed ? ` (${unparsed} not in SUP-nnnnn form, ignored for the sequence)` : ''}`);
  console.log(`Suppliers without a code : ${uncoded.length}`);
  console.log(`Counter ${key.padEnd(17)}: ${counterAt}${highest ? ` (highest code on file: ${highest})` : ''}`);

  // Only ever raised: a counter behind the codes on file would hand them out again.
  if (highest > counterAt) {
    if (apply) {
      await Counter.updateOne({ _id: key, seq: { $lt: highest } }, { $set: { seq: highest } }, { upsert: true });
      console.log(`  + counter raised ${counterAt} -> ${highest}`);
    } else {
      console.log(`  ~ counter would be raised ${counterAt} -> ${highest}`);
    }
  }

  if (uncoded.length === 0) {
    console.log('\nNothing to do.');
    await mongoose.disconnect();
    return;
  }

  const assigned: { code: string; companyName: string; status: string; created: string }[] = [];
  let skipped = 0;
  let next = Math.max(counterAt, highest);

  for (const supplier of uncoded) {
    let code: string;
    if (apply) {
      code = await nextSupplierCode(supplier);
      // Conditional, so a code given by the app since the scan above stands.
      const result = await SupplierProfile.updateOne(
        { _id: supplier._id, ...NO_CODE },
        { $set: { supplierCode: code } },
        { timestamps: false }
      );
      if (result.modifiedCount === 0) {
        skipped += 1;
        continue;
      }
    } else {
      next += 1;
      code = `${sbuNumberPrefix()}SUP-${String(next).padStart(5, '0')}`;
    }
    assigned.push({
      code,
      companyName: String((supplier as any).companyName || '').slice(0, 40),
      status: `${(supplier as any).status}${(supplier as any).isDeleted ? ' (deleted)' : ''}`,
      created: (supplier as any).createdAt ? new Date((supplier as any).createdAt).toISOString().slice(0, 10) : '—'
    });
  }

  console.log(`\n${apply ? 'Assigned' : 'Would assign'} ${assigned.length} code(s)${skipped ? `; ${skipped} skipped (coded meanwhile)` : ''}:`);
  console.table(assigned.slice(0, 50));
  if (assigned.length > 50) console.log(`… and ${assigned.length - 50} more`);

  if (apply) {
    const after = await Counter.findById(key).lean<{ seq: number } | null>();
    console.log(`Counter ${key} is now ${after?.seq ?? 0}.`);
  } else {
    console.log('\nDry run only — re-run with --apply to write these codes.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Supplier code backfill failed:', err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
