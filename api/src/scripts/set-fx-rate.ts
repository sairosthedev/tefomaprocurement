/**
 * Record an exchange rate against USD for group-wide rules (the COO limit
 * today, group spend reporting next).
 *
 *   npm run fx:set -- --currency ZAR --rate 18.45 --source "RBZ 2026-10-29"
 *   npm run fx:set -- --list
 *
 * Rates are added, never edited: each run inserts a row effective from now (or
 * --from YYYY-MM-DD), so earlier PO assessments stay explainable by the rate
 * they used. Group-level and deliberately not in the admin screens — an SBU
 * admin must not be able to move the rate their own COO limit is measured by.
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import FxRate from '../models/FxRate.model.js';
import { platformDbName } from '../tenancy/connections.js';

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log(`Registry : ${platformDbName()}\n`);

  if (!process.argv.includes('--list')) {
    const currency = arg('currency')?.toUpperCase();
    const rate = Number(arg('rate'));
    const from = arg('from');
    if (!currency) throw new Error('--currency is required, e.g. --currency ZAR');
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('--rate must be a positive number of units per USD');

    await FxRate.create({
      currency,
      unitsPerUsd: rate,
      effectiveFrom: from ? new Date(from) : new Date(),
      source: arg('source') || undefined,
      setBy: process.env.USER || process.env.USERNAME || 'cli'
    });
    console.log(`  + ${currency} ${rate} per USD${from ? ` from ${from}` : ''}\n`);
  }

  const rows = await FxRate.find({}).sort({ currency: 1, effectiveFrom: -1 }).lean();
  for (const row of rows) {
    console.log(
      `  ${row.currency}  ${String(row.unitsPerUsd).padEnd(10)} from ${row.effectiveFrom.toISOString().slice(0, 10)}` +
        `${row.source ? `  (${row.source})` : ''}`
    );
  }
  if (rows.length === 0) console.log('  No rates recorded. Non-USD POs will all route to the COO until one is set.');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Setting FX rate failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
