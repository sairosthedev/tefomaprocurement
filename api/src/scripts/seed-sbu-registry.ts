/**
 * Seed the SBU registry in the platform database.
 *
 * FOSSIL is pointed at the database already named in MONGODB_URI, so the
 * existing data stays exactly where it is — no copy, no migration, and the
 * system behaves as it did before. The other SBUs are created as `onboarding`
 * with empty databases that come into being on first write.
 *
 *   npm run seed:sbu-registry -w api            # FOSSIL only
 *   npm run seed:sbu-registry -w api -- --all   # every SBU in the group
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import Sbu, { type SbuCountry, type SbuCurrency } from '../models/Sbu.model.js';
import { platformDbName } from '../tenancy/connections.js';
import { getAppEnv } from '../config/env.js';
import { databaseFromUri } from '../tenancy/mongoUri.js';

interface SbuSeed {
  code: string;
  name: string;
  country: SbuCountry;
  baseCurrency: SbuCurrency;
}

/** Codes match the group command centre's fixtures, so figures key cleanly. */
const GROUP: SbuSeed[] = [
  { code: 'FOSSIL', name: 'Fossil Contracting', country: 'ZW', baseCurrency: 'USD' },
  { code: 'DOKUMA', name: 'Dokuma', country: 'ZW', baseCurrency: 'USD' },
  { code: 'KHAYA_CEMENT', name: 'Khaya Cement', country: 'ZW', baseCurrency: 'USD' },
  { code: 'KURIMA_CENTRE', name: 'Kurima Centre', country: 'ZW', baseCurrency: 'USD' },
  { code: 'MANDFAR', name: 'Mandfar', country: 'ZW', baseCurrency: 'USD' },
  { code: 'MASIMBA', name: 'Masimba', country: 'ZW', baseCurrency: 'USD' },
  { code: 'PERSIMMON', name: 'Persimmon', country: 'ZW', baseCurrency: 'USD' },
  { code: 'PROPLASTICS', name: 'ProPlastics', country: 'ZW', baseCurrency: 'USD' },
  { code: 'RHOPOWER', name: 'Rhopower', country: 'ZW', baseCurrency: 'USD' },
  { code: 'GRAIN_HUB', name: 'The Grain Hub', country: 'ZW', baseCurrency: 'USD' },
  { code: 'TITAN', name: 'Titan', country: 'ZW', baseCurrency: 'USD' },
  { code: 'TRENDS', name: 'Trends', country: 'ZW', baseCurrency: 'USD' },
  { code: 'ENVIRO_PLASTIC', name: 'Enviro Plastic', country: 'ZA', baseCurrency: 'ZAR' },
  { code: 'MANGETHE', name: 'Mangethe', country: 'ZA', baseCurrency: 'ZAR' },
  { code: 'THANDO_KINETICS', name: 'Thando Kinetics', country: 'ZA', baseCurrency: 'ZAR' }
];

function currentDbName(uri: string): string {
  const name = databaseFromUri(uri);
  if (!name) {
    throw new Error('MONGODB_URI has no database name, so FOSSIL has nothing to point at.');
  }
  return name;
}

async function main(): Promise<void> {
  const all = process.argv.includes('--all');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  const fossilDb = currentDbName(uri);
  const appEnv = getAppEnv();

  console.log(`Registry database : ${platformDbName()}`);
  console.log(`FOSSIL database   : ${fossilDb} (existing data, left in place)`);
  console.log(`Environment       : ${appEnv}\n`);

  const wanted = all ? GROUP : GROUP.filter((sbu) => sbu.code === 'FOSSIL');

  for (const seed of wanted) {
    const isFossil = seed.code === 'FOSSIL';
    const dbName = isFossil ? fossilDb : `sourceline-${appEnv}-${seed.code.toLowerCase()}`;

    const existing = await Sbu.findOne({ code: seed.code });
    if (existing) {
      console.log(`  = ${seed.code.padEnd(16)} already registered (${existing.dbName})`);
      continue;
    }

    await Sbu.create({
      code: seed.code,
      name: seed.name,
      country: seed.country,
      baseCurrency: seed.baseCurrency,
      // Only Fossil has data today; everything else still has to be onboarded.
      status: isFossil ? 'active' : 'onboarding',
      dbName,
      domains: [],
      branding: { legalName: seed.name }
    });
    console.log(`  + ${seed.code.padEnd(16)} -> ${dbName}`);
  }

  const total = await Sbu.countDocuments();
  console.log(`\nRegistry now holds ${total} SBU(s).`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Seeding the SBU registry failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
