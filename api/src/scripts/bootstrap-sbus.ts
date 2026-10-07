/**
 * Bring SBU databases into service.
 *
 * For each SBU in the registry this builds the indexes every model declares
 * and creates one administrator, so somebody can sign in and set the business
 * unit up. It does nothing to an SBU that already has users.
 *
 * Collections and indexes are created on demand, not up front (see
 * tenancy/connections.ts), so --with-indexes is not cosmetic: until it is run
 * an SBU has no unique indexes, and nothing stops a duplicate email or
 * document number. Run it before the business unit takes real work.
 *
 * Generated passwords are printed once and never stored anywhere else — copy
 * them out of this run, hand them over through a password manager, and have
 * each administrator change theirs on first sign-in.
 *
 *   npm run bootstrap:sbus -- --dry-run
 *   npm run bootstrap:sbus                      # every active/onboarding SBU
 *   npm run bootstrap:sbus -- --only DOKUMA,TITAN
 *   npm run bootstrap:sbus -- --admin-email ops@example.com
 *   npm run bootstrap:sbus -- --only DOKUMA --with-indexes   # going live
 */
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import { activeSbus } from '../tenancy/registry.js';
import { connectionForSbu } from '../tenancy/connections.js';
import { runWithSbu, type SbuRef } from '../tenancy/sbuContext.js';
import { User } from '../models/index.js';
import { SBU_MODELS } from '../models/registerModels.js';

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

/**
 * Readable but not guessable. Printed once, intended to be changed on first
 * sign-in rather than to be a long-term secret.
 */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(16);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function adminEmailFor(sbu: SbuRef, template: string | null): string {
  if (template) {
    // One shared address: tag it per SBU so each user record stays distinct.
    const [local, domain] = template.split('@');
    return `${local}+${sbu.code.toLowerCase()}@${domain}`;
  }
  return `admin@${sbu.code.toLowerCase().replace(/_/g, '-')}.sourceline.local`;
}

interface Result {
  sbu: string;
  email: string;
  password: string;
}

async function bootstrapSbu(
  sbu: SbuRef,
  options: { dryRun: boolean; adminEmail: string | null; withIndexes: boolean }
): Promise<Result | null> {
  const connection = connectionForSbu(sbu);
  process.stdout.write(`\n${sbu.code.padEnd(16)} ${sbu.dbName}\n`);

  // Building every model's indexes also creates every collection, which costs
  // 24 collections per SBU whether or not the SBU is used. Atlas caps a shared
  // cluster at 500 collections in total, so doing this for 15 SBUs up front
  // consumes the whole cluster on empty data. Off by default: pass
  // --with-indexes for an SBU that is actually going live.
  if (options.withIndexes) {
    if (options.dryRun) {
      console.log(`  ~ would build indexes for ${Object.keys(SBU_MODELS).length} models`);
    } else {
      for (const name of Object.keys(SBU_MODELS)) {
        await connection.model(name).createIndexes();
      }
      console.log(`  + indexes built for ${Object.keys(SBU_MODELS).length} models`);
    }
  } else {
    console.log('  . indexes deferred — run again with --with-indexes before real use');
  }

  const existing = await runWithSbu(sbu, () => User.countDocuments({ isDeleted: { $ne: true } }));
  if (existing > 0) {
    console.log(`  = ${existing} user(s) already present, leaving the SBU alone`);
    return null;
  }

  const email = adminEmailFor(sbu, options.adminEmail);
  const password = generatePassword();

  if (options.dryRun) {
    console.log(`  ~ would create administrator ${email}`);
    return null;
  }

  await runWithSbu(sbu, () =>
    User.create({
      email,
      password,
      firstName: sbu.name || sbu.code,
      lastName: 'Administrator',
      role: 'admin',
      status: 'active'
    })
  );
  console.log(`  + administrator ${email}`);

  return { sbu: sbu.code, email, password };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const only = arg('only');
  const adminEmail = arg('admin-email');
  const withIndexes = process.argv.includes('--with-indexes');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  if (dryRun) console.log('DRY RUN - nothing will be written\n');

  let sbus = await activeSbus();
  if (sbus.length === 0) throw new Error('The SBU registry is empty. Run seed:sbu-registry first.');

  if (only) {
    const wanted = new Set(only.split(',').map((c) => c.trim().toUpperCase()));
    sbus = sbus.filter((sbu) => wanted.has(sbu.code));
    if (sbus.length === 0) throw new Error(`No SBU in the registry matches --only ${only}`);
  }

  const created: Result[] = [];
  for (const sbu of sbus) {
    const result = await bootstrapSbu(sbu, { dryRun, adminEmail, withIndexes });
    if (result) created.push(result);
  }

  if (created.length > 0) {
    console.log('\n' + '='.repeat(72));
    console.log('ADMINISTRATOR CREDENTIALS - shown once, not recoverable afterwards');
    console.log('='.repeat(72));
    for (const row of created) {
      console.log(`${row.sbu.padEnd(18)} ${row.email.padEnd(44)} ${row.password}`);
    }
    console.log('='.repeat(72));
    console.log('Hand these over through a password manager and have each one changed.');
  }

  console.log(dryRun ? '\nDry run complete.' : `\nBootstrapped ${sbus.length} SBU(s).`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Bootstrapping SBUs failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
