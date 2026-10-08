/**
 * Numbering check.
 *
 * Proves the thing the atomic counter was introduced for: that documents
 * created at the same moment get distinct numbers. The old
 * `countDocuments() + 1` scheme handed concurrent savers the same count, so
 * two requisitions raised together were numbered identically.
 *
 * Runs against a throwaway database on the cluster in MONGODB_URI and drops it
 * afterwards. It never touches a database named in the registry.
 *
 *   npm run check:numbering -w api
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

process.env.SBU_STRICT_CONTEXT = 'true';

import { StoreRequisition } from '../models/index.js';
import { runWithSbu, type SbuRef } from '../tenancy/sbuContext.js';
import { connectionForSbu, resetConnectionCacheForTests } from '../tenancy/connections.js';
import { counterKey } from '../services/numbering.service.js';

const SBU: SbuRef = {
  code: 'NUMCHECK',
  name: 'Numbering check',
  dbName: `sourceline-numcheck-${Date.now().toString(36)}`
};

const CONCURRENCY = 30;
let failures = 0;

function check(description: string, passed: boolean, detail = ''): void {
  if (passed) {
    console.log(`  ok    ${description}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ''}`);
  }
}

function newRequisition(index: number) {
  return {
    site: new mongoose.Types.ObjectId(),
    department: new mongoose.Types.ObjectId(),
    requestedBy: new mongoose.Types.ObjectId(),
    purpose: `concurrency probe ${index}`,
    items: []
  };
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  console.log(`\nNumbering check on ${SBU.dbName}\n`);

  // 1. Create documents concurrently and look for collisions.
  const created = await runWithSbu(SBU, () =>
    Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) => StoreRequisition.create(newRequisition(i)))
    )
  );

  const numbers = created.map((doc: { requisitionNumber: string }) => doc.requisitionNumber);
  const distinct = new Set(numbers);

  check(
    `${CONCURRENCY} concurrent creates produce ${CONCURRENCY} distinct numbers`,
    distinct.size === CONCURRENCY,
    `${distinct.size} distinct`
  );

  const year = new Date().getFullYear();
  const sequences = numbers
    .map((n) => /^SR-(\d{4})-(\d+)$/.exec(n))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[2]))
    .sort((a, b) => a - b);

  check('every number is in the expected format', sequences.length === CONCURRENCY,
    `${sequences.length} parsed of ${CONCURRENCY}`);
  check('sequences run 1..N with no gaps',
    sequences.every((seq, i) => seq === i + 1),
    `got ${sequences[0]}..${sequences[sequences.length - 1]}`);

  // 2. The counter itself holds the high-water mark.
  const connection = connectionForSbu(SBU);
  const Counter = connection.model('Counter');
  const counter = await Counter.findById(counterKey('storeRequisition', year)).lean<{ seq: number } | null>();
  check('counter records the high-water mark', counter?.seq === CONCURRENCY, `seq=${counter?.seq}`);

  // 3. Seeding a counter forward stops new numbers colliding with old ones,
  //    which is what seed-counters.ts does before the switch-over.
  await Counter.updateOne(
    { _id: counterKey('storeRequisition', year) },
    { $set: { seq: 500 } },
    { upsert: true }
  );
  const afterSeed = await runWithSbu(SBU, () => StoreRequisition.create(newRequisition(999)));
  check('numbering resumes above a seeded counter',
    afterSeed.requisitionNumber === `SR-${year}-${String(501).padStart(5, '0')}`,
    afterSeed.requisitionNumber);

  await connection.dropDatabase();
  resetConnectionCacheForTests();
  await mongoose.disconnect();

  console.log(failures === 0 ? '\nAll numbering checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('Numbering check errored:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
