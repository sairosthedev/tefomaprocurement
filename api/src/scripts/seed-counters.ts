/**
 * Initialise the atomic numbering counters from the documents already in each
 * SBU database.
 *
 * This has to run before (or with) the deploy that switches numbering over to
 * `Counter`. A fresh counter starts at zero, so without seeding the first new
 * purchase order would be handed `PO-2026-00001` again and collide with the
 * one that already exists.
 *
 * For every numbered collection it reads the existing numbers, takes the
 * highest sequence seen per year, and raises the counter to it. Counters are
 * only ever raised, never lowered, so re-running is safe.
 *
 *   npm run seed:counters -w api -- --dry-run
 *   npm run seed:counters -w api
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import { activeSbus } from '../tenancy/registry.js';
import { connectionForSbu, platformConnection } from '../tenancy/connections.js';
import { counterKey } from '../services/numbering.service.js';
import { databaseFromUri } from '../tenancy/mongoUri.js';
import type { SbuRef } from '../tenancy/sbuContext.js';

interface Numbered {
  /** Counter type, matching the `type` passed to nextNumber() in the model hook. */
  type: string;
  /** Mongoose model name. */
  model: string;
  /** Field holding the formatted number. */
  field: string;
  /**
   * Captures the year and the sequence from a formatted number. Store
   * transactions carry a type segment (`ST-ISS-2026-000123`), so each pattern
   * is written out rather than derived from a prefix.
   */
  pattern: RegExp;
}

const NUMBERED: Numbered[] = [
  { type: 'purchaseOrder', model: 'PurchaseOrder', field: 'poNumber', pattern: /^PO-(\d{4})-(\d+)$/ },
  { type: 'purchaseRequisition', model: 'PurchaseRequisition', field: 'requisitionNumber', pattern: /^PR-(\d{4})-(\d+)$/ },
  { type: 'rfq', model: 'RFQ', field: 'rfqNumber', pattern: /^RFQ-(\d{4})-(\d+)$/ },
  { type: 'quotation', model: 'Quotation', field: 'quotationNumber', pattern: /^QT-(\d{4})-(\d+)$/ },
  { type: 'invoice', model: 'Invoice', field: 'invoiceNumber', pattern: /^INV-(\d{4})-(\d+)$/ },
  { type: 'payment', model: 'Payment', field: 'paymentNumber', pattern: /^PAY-(\d{4})-(\d+)$/ },
  { type: 'delivery', model: 'Delivery', field: 'grvNumber', pattern: /^GRV-(\d{4})-(\d+)$/ },
  { type: 'storeRequisition', model: 'StoreRequisition', field: 'requisitionNumber', pattern: /^SR-(\d{4})-(\d+)$/ },
  { type: 'stockTransfer', model: 'StockTransfer', field: 'transferNumber', pattern: /^TRF-(\d{4})-(\d+)$/ },
  { type: 'storeTransaction', model: 'StoreTransaction', field: 'transactionNumber', pattern: /^ST-[A-Z]+-(\d{4})-(\d+)$/ }
];

async function seedSbu(sbu: SbuRef, dryRun: boolean): Promise<void> {
  const connection = connectionForSbu(sbu);
  console.log(`\n${sbu.code}  (${sbu.dbName})`);

  const Counter = connection.model('Counter');
  let touched = 0;

  for (const spec of NUMBERED) {
    const Model = connection.model(spec.model);
    const rows = await Model.find(
      { [spec.field]: { $nin: [null, ''] } },
      { [spec.field]: 1, _id: 0 }
    ).lean<Array<Record<string, string>>>();

    // Highest sequence seen per year.
    const maxByYear = new Map<number, number>();
    let unparsed = 0;

    for (const row of rows) {
      const value = row[spec.field];
      if (typeof value !== 'string') continue;
      const match = spec.pattern.exec(value.trim());
      if (!match) {
        unparsed += 1;
        continue;
      }
      const year = Number(match[1]);
      const seq = Number(match[2]);
      if (!Number.isFinite(year) || !Number.isFinite(seq)) continue;
      maxByYear.set(year, Math.max(maxByYear.get(year) ?? 0, seq));
    }

    for (const [year, max] of [...maxByYear.entries()].sort((a, b) => a[0] - b[0])) {
      const key = counterKey(spec.type, year);
      const existing = await Counter.findById(key).lean<{ seq: number } | null>();
      const current = existing?.seq ?? 0;

      if (current >= max) {
        console.log(`  = ${key.padEnd(34)} already at ${current} (max seen ${max})`);
        continue;
      }

      touched += 1;
      if (dryRun) {
        console.log(`  ~ ${key.padEnd(34)} ${current} -> ${max}  (dry run)`);
      } else {
        await Counter.updateOne({ _id: key }, { $set: { seq: max } }, { upsert: true });
        console.log(`  + ${key.padEnd(34)} ${current} -> ${max}`);
      }
    }

    if (unparsed > 0) {
      console.log(
        `  ! ${spec.model}: ${unparsed} ${spec.field} value(s) did not match ${spec.pattern} and were ignored`
      );
    }
  }

  if (touched === 0) console.log('  nothing to do');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  if (dryRun) console.log('DRY RUN - no counters will be written');

  let sbus: SbuRef[] = [];
  try {
    sbus = await activeSbus();
  } catch {
    sbus = [];
  }

  if (sbus.length === 0) {
    // Registry not seeded: fall back to the single database in MONGODB_URI.
    console.log(`No SBU registry in ${platformConnection().name}; using MONGODB_URI directly.`);
    sbus = [{ code: process.env.DEFAULT_SBU_CODE || 'FOSSIL', dbName: databaseFromUri(uri) }];
  }

  for (const sbu of sbus) {
    await seedSbu(sbu, dryRun);
  }

  console.log(dryRun ? '\nDry run complete.' : '\nCounters seeded.');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Seeding counters failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
