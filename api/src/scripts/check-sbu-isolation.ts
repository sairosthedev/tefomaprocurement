/**
 * Isolation check for the multi-database foundation.
 *
 * Boots two throwaway SBU databases and asserts that data written in one is
 * invisible from the other, and that an SBU-scoped model used with no SBU in
 * context fails closed rather than quietly hitting whichever database is open.
 *
 * Runs against the cluster in MONGODB_URI and drops both databases afterwards.
 * It never touches the SBU databases named in the registry.
 *
 *   npm run check:isolation -w api
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

// Fail closed while the check runs: no falling back to MONGODB_URI's database.
process.env.SBU_STRICT_CONTEXT = 'true';

import { Site, Department } from '../models/index.js';
import { runWithSbu, type SbuRef } from '../tenancy/sbuContext.js';
import { resetConnectionCacheForTests } from '../tenancy/connections.js';

const SUFFIX = Date.now().toString(36);
const ALPHA: SbuRef = { code: 'ISO_ALPHA', name: 'Alpha', dbName: `sourceline-isocheck-a-${SUFFIX}` };
const BETA: SbuRef = { code: 'ISO_BETA', name: 'Beta', dbName: `sourceline-isocheck-b-${SUFFIX}` };

let failures = 0;

function check(description: string, passed: boolean, detail = ''): void {
  if (passed) {
    console.log(`  ok    ${description}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  console.log(`\nIsolation check on ${ALPHA.dbName} and ${BETA.dbName}\n`);

  // 1. A write in one SBU is invisible from the other.
  await runWithSbu(ALPHA, async () => {
    await Site.create({ code: 'HQ', name: 'Alpha Head Office' });
    await Department.create({ name: 'Alpha Procurement', code: 'PROC' });
  });

  await runWithSbu(BETA, async () => {
    await Site.create({ code: 'HQ', name: 'Beta Head Office' });
  });

  const alphaSites = await runWithSbu(ALPHA, () => Site.find({ isDeleted: false }).lean());
  const betaSites = await runWithSbu(BETA, () => Site.find({ isDeleted: false }).lean());

  check('each SBU sees exactly its own site', alphaSites.length === 1 && betaSites.length === 1,
    `alpha=${alphaSites.length} beta=${betaSites.length}`);
  check('alpha reads alpha data', alphaSites[0]?.name === 'Alpha Head Office', alphaSites[0]?.name);
  check('beta reads beta data', betaSites[0]?.name === 'Beta Head Office', betaSites[0]?.name);

  // 2. The same unique key exists independently in both — today's unique
  //    indexes are already per-SBU because the databases are separate.
  check('the same site code lives in both SBUs', alphaSites[0]?.code === 'HQ' && betaSites[0]?.code === 'HQ');

  // 3. A collection written only in alpha is empty in beta.
  const betaDepartments = await runWithSbu(BETA, () => Department.find({}).lean());
  check('beta cannot see alpha departments', betaDepartments.length === 0, `found ${betaDepartments.length}`);

  // 4. Fail closed with no SBU in context.
  let threw = false;
  try {
    await Site.find({});
  } catch {
    threw = true;
  }
  check('an SBU model with no context throws', threw);

  // 5. Context does not leak across concurrent work.
  const [a, b] = await Promise.all([
    runWithSbu(ALPHA, () => Site.findOne({}).lean()),
    runWithSbu(BETA, () => Site.findOne({}).lean())
  ]);
  check('concurrent requests keep separate contexts',
    a?.name === 'Alpha Head Office' && b?.name === 'Beta Head Office',
    `${a?.name} / ${b?.name}`);

  // Clean up both throwaway databases.
  for (const sbu of [ALPHA, BETA]) {
    await mongoose.connection.useDb(sbu.dbName, { useCache: true }).dropDatabase();
  }
  resetConnectionCacheForTests();
  await mongoose.disconnect();

  console.log(failures === 0 ? '\nAll isolation checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('Isolation check errored:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
