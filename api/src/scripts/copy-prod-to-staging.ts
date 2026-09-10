/**
 * Copy account data from production into a non-production database.
 *
 *   npx tsx src/scripts/copy-prod-to-staging.ts --confirm            (staging)
 *   npx tsx src/scripts/copy-prod-to-staging.ts --confirm --to=dev   (local dev)
 *
 * Read-only against production; writes only to the chosen target.
 *
 * WHAT THIS COPIES
 * ----------------
 * Real accounts: names, email addresses, and for suppliers the company
 * registration numbers, contact details and bank details held on their
 * profiles. Password hashes are copied verbatim, so the target accepts the same
 * passwords as production — a compromise of the target exposes credentials that
 * work in production.
 *
 * On staging that is a deliberate, confirmed choice, recorded here so whoever
 * reads this next knows it was not an accident. Staging is internet-reachable
 * and, while OTP_EXPOSE_IN_RESPONSE is enabled there, its login endpoint hands
 * the one-time code back to the caller — so there is effectively no second
 * factor, and anyone who finds the URL can sign in as any user whose email they
 * know. If staging ever stops being disposable, either turn auto-fill off
 * (OTP_EXPOSE_IN_RESPONSE=false) or stop copying real records.
 *
 * On a developer machine the same data lands in a local database and travels
 * with the laptop. That is the trade for testing against realistic volumes.
 *
 * The guard rails below refuse to write to production under any flag
 * combination. That is the point of them: widen the targets if you need to, but
 * do not weaken the check that keeps production out of the destination slot.
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.join(__dirname, '../..');

/** Collections to copy, in dependency order. */
const COLLECTIONS = ['sites', 'departments', 'users', 'supplierprofiles'];

/**
 * Where the data may be sent. Each target names the env file holding its URI
 * and the substring its database name must contain, so a mistyped or
 * repointed URI cannot quietly resolve to production.
 */
const TARGETS: Record<string, { envFile: string; mustContain: string; label: string }> = {
  staging: { envFile: '.env.staging', mustContain: 'staging', label: 'staging' },
  dev: { envFile: '.env.development', mustContain: '-dev', label: 'local development' }
};

function uriFrom(file: string): string {
  const full = path.join(API_ROOT, file);
  if (!fs.existsSync(full)) throw new Error(`Missing env file: ${file}`);
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const t = line.trim();
    if (t.startsWith('MONGODB_URI=')) return t.slice('MONGODB_URI='.length);
  }
  throw new Error(`No MONGODB_URI in ${file}`);
}

function dbNameOf(uri: string): string {
  return (uri.split('?')[0].split('/').pop() || '').trim();
}

async function main(): Promise<void> {
  const targetArg = (process.argv.find((a) => a.startsWith('--to=')) || '--to=staging').slice('--to='.length);
  const target = TARGETS[targetArg];

  if (!target) {
    console.error(`Unknown target "${targetArg}". Expected one of: ${Object.keys(TARGETS).join(', ')}.`);
    process.exit(1);
  }

  if (!process.argv.includes('--confirm')) {
    console.error(`Refusing to run without --confirm. This replaces the ${target.label} database.`);
    process.exit(1);
  }

  const sourceUri = uriFrom('.env'); // production
  const targetUri = uriFrom(target.envFile);

  const sourceDb = dbNameOf(sourceUri);
  const targetDb = dbNameOf(targetUri);

  // The destructive half runs against the target, so refuse anything that does
  // not look like the environment that was asked for, and refuse a target that
  // is the same database as the source.
  if (!targetDb.includes(target.mustContain)) {
    console.error(
      `Refusing: target database "${targetDb}" does not look like ${target.label} ` +
        `(expected its name to contain "${target.mustContain}").`
    );
    process.exit(1);
  }
  if (sourceDb === targetDb) {
    console.error('Refusing: source and target are the same database.');
    process.exit(1);
  }

  console.log(`source (read-only) : ${sourceDb}`);
  console.log(`target (replaced)  : ${targetDb}  [${target.label}]\n`);

  const src = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 20000 }).asPromise();
  const dst = await mongoose.createConnection(targetUri, { serverSelectionTimeoutMS: 20000 }).asPromise();

  // Re-check against the live connections, not just the URI strings.
  if (dst.db!.databaseName === src.db!.databaseName) {
    console.error('Refusing: connections resolved to the same database.');
    process.exit(1);
  }

  for (const name of COLLECTIONS) {
    const docs = await src.db!.collection(name).find({}).toArray();
    if (docs.length === 0) {
      console.log(`${name.padEnd(20)} 0 documents — skipped`);
      continue;
    }

    // Replace rather than append, so re-running is idempotent and the target
    // never ends up with duplicates of the same account.
    await dst.db!.collection(name).deleteMany({});
    await dst.db!.collection(name).insertMany(docs, { ordered: false });

    const copied = await dst.db!.collection(name).countDocuments();
    console.log(`${name.padEnd(20)} ${copied} documents copied`);
  }

  console.log(`\nDone. ${target.label} now holds real production accounts.`);
  console.log('Passwords are the production passwords.');

  await src.close();
  await dst.close();
}

await main();
