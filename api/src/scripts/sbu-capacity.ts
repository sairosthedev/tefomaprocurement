/**
 * Collection budget for the cluster.
 *
 * A database per SBU is cheap in storage and expensive in collections: every
 * model is one collection, so each SBU costs up to 24 of them. Atlas caps a
 * shared (M0/M2/M5) cluster at 500 collections across all databases, which a
 * pilot of 15 SBUs will reach on its own — and faster still if more than one
 * environment shares the cluster.
 *
 * This reports where the budget is going, and can reclaim collections that
 * were created empty by eager index building.
 *
 *   npm run sbu:capacity
 *   npm run sbu:capacity -- --reclaim-empty           # show what it would drop
 *   npm run sbu:capacity -- --reclaim-empty --confirm # actually drop them
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

/** Atlas shared-tier ceiling. Dedicated tiers (M10+) have no such limit. */
const SHARED_TIER_LIMIT = 500;

const SYSTEM_DBS = new Set(['admin', 'local', 'config']);

async function main(): Promise<void> {
  const reclaim = process.argv.includes('--reclaim-empty');
  const confirm = process.argv.includes('--confirm');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  const { databases } = await mongoose.connection.db!.admin().listDatabases();

  interface Row {
    name: string;
    collections: number;
    empty: string[];
  }
  const rows: Row[] = [];

  for (const database of databases) {
    if (SYSTEM_DBS.has(database.name)) continue;
    const connection = mongoose.connection.useDb(database.name);
    const collections = await connection.db!.listCollections().toArray();

    const empty: string[] = [];
    for (const collection of collections) {
      const count = await connection.db!.collection(collection.name).estimatedDocumentCount();
      if (count === 0) empty.push(collection.name);
    }
    rows.push({ name: database.name, collections: collections.length, empty });
  }

  rows.sort((a, b) => b.collections - a.collections);

  const total = rows.reduce((sum, r) => sum + r.collections, 0);
  const totalEmpty = rows.reduce((sum, r) => sum + r.empty.length, 0);

  console.log('\ndatabase                                    collections   empty');
  console.log('-'.repeat(68));
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(44)}${String(row.collections).padStart(8)}${String(row.empty.length).padStart(8)}`
    );
  }
  console.log('-'.repeat(68));
  console.log(`${'TOTAL'.padEnd(44)}${String(total).padStart(8)}${String(totalEmpty).padStart(8)}`);

  const headroom = SHARED_TIER_LIMIT - total;
  console.log(
    `\nShared-tier limit ${SHARED_TIER_LIMIT}. Using ${total}, ${headroom} left` +
      (headroom <= 0 ? ' — the cluster is full; new collections will be refused.' : '.')
  );
  if (totalEmpty > 0) {
    console.log(
      `${totalEmpty} collection(s) hold no documents. --reclaim-empty drops the ones in SBU databases.`
    );
  }

  if (reclaim) {
    // Only ever touch the per-SBU databases this system creates. Fossil's
    // database, the platform registry and anything else on the cluster are
    // left alone: an empty collection elsewhere may be deliberate.
    const targets = rows.filter((r) => /^sourceline-[a-z]+-/.test(r.name) && r.empty.length > 0);
    const count = targets.reduce((sum, r) => sum + r.empty.length, 0);

    console.log(
      `\n${confirm ? 'Dropping' : 'Would drop'} ${count} empty collection(s) across ${targets.length} SBU database(s).`
    );

    for (const target of targets) {
      if (confirm) {
        const connection = mongoose.connection.useDb(target.name);
        for (const name of target.empty) {
          await connection.db!.collection(name).drop().catch(() => undefined);
        }
      }
      console.log(`  ${confirm ? 'dropped' : 'would drop'} ${String(target.empty.length).padStart(3)} in ${target.name}`);
    }

    if (!confirm) {
      console.log('\nNothing was changed. Re-run with --confirm to drop them.');
    } else {
      console.log(`\nReclaimed ${count} collection(s). They are recreated on first write.`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Capacity report failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
