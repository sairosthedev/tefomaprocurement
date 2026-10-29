/**
 * Set one SBU's approval limit and the branding printed on its documents.
 *
 *   npm run sbu:settings -- --code KHAYAH_CEMENT --coo-threshold-usd 10000
 *   npm run sbu:settings -- --code MANGETHE --legal-name "Mangethe (Pty) Ltd" \
 *     --address "12 Main Rd, Durban" --vat 4123456789 --logo-url https://.../mangethe.png
 *   npm run sbu:settings -- --list
 *
 * Only the flags given are changed. Group-level, like the FX rates: an SBU's
 * own admin must not be able to raise the limit their COO sign-off depends on.
 * The logo must be a PNG or JPEG reachable over HTTPS for it to print.
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import Sbu, { type ISbu } from '../models/Sbu.model.js';
import { platformDbName } from '../tenancy/connections.js';

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

function describe(sbu: ISbu): string {
  const b = sbu.branding || {};
  return [
    `${sbu.code.padEnd(16)} ${sbu.baseCurrency}  COO ≥ USD ${(sbu.approvalPolicy?.cooThresholdUsd ?? 5000).toLocaleString('en-US')}`,
    `    ${b.legalName || sbu.name}${b.vatNumber ? `  VAT ${b.vatNumber}` : ''}${b.logoUrl ? '  [logo]' : ''}`,
    b.address ? `    ${b.address}` : ''
  ].filter(Boolean).join('\n');
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log(`Registry : ${platformDbName()}\n`);

  if (process.argv.includes('--list')) {
    for (const sbu of await Sbu.find({}).sort({ code: 1 })) console.log(describe(sbu));
    await mongoose.disconnect();
    return;
  }

  const code = arg('code')?.toUpperCase();
  if (!code) throw new Error('--code is required, e.g. --code KHAYAH_CEMENT');
  const sbu = await Sbu.findOne({ code });
  if (!sbu) throw new Error(`Not in the registry: ${code}`);

  const threshold = arg('coo-threshold-usd');
  if (threshold !== null) {
    const value = Number(threshold);
    if (!Number.isFinite(value) || value < 0) throw new Error('--coo-threshold-usd must be a non-negative number');
    sbu.set('approvalPolicy.cooThresholdUsd', value);
  }

  const brandingFlags: Array<[string, keyof ISbu['branding']]> = [
    ['legal-name', 'legalName'],
    ['address', 'address'],
    ['vat', 'vatNumber'],
    ['logo-url', 'logoUrl']
  ];
  for (const [flag, field] of brandingFlags) {
    const value = arg(flag);
    if (value !== null) sbu.set(`branding.${field}`, value);
  }

  await sbu.save();
  console.log(describe(sbu));
  console.log('\nSaved. Running servers pick this up within the registry cache window (60s).');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Setting SBU settings failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
