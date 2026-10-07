/**
 * Give each SBU its hostname.
 *
 * Once an SBU has a domain, the API resolves the business unit from the address
 * the request came in on, and the login page stops asking — the hostname has
 * already said which business unit the user wants. Until then everything falls
 * back to the X-Sbu-Code header.
 *
 *   npm run sbu:domains -- --base sourceline.co.zw --dry-run
 *   npm run sbu:domains -- --base sourceline.co.zw
 *   APP_ENV=staging npx tsx api/src/scripts/set-sbu-domains.ts --base staging.sourceline.co.zw
 *
 * Idempotent: it adds the hostname if missing and leaves any others alone.
 * --replace discards an SBU's existing hostnames instead of adding to them.
 *
 * --dns prints the DNS records these hostnames need, and writes nothing:
 *
 *   npm run sbu:domains -- --base sourceline.co.zw --dns
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import Sbu, { type ISbu } from '../models/Sbu.model.js';
import { platformDbName } from '../tenancy/connections.js';

/**
 * Subdomain per SBU. Mostly the code lower-cased, but several are shortened to
 * what people actually call the business — nobody types `khayah_cement`.
 */
const SUBDOMAIN: Record<string, string> = {
  FOSSIL: 'fossil',
  DOKUMA: 'dokuma',
  KHAYAH_CEMENT: 'khayah',
  KURIMA_CENTRE: 'kurima',
  MANDFAR: 'mandfar',
  MASIMBA: 'masimba',
  PERSIMMON: 'persimmon',
  PROPLASTICS: 'proplastics',
  RHOPOWER: 'rhopower',
  GRAIN_HUB: 'grainhub',
  TITAN: 'titan',
  TRENDS: 'trends',
  ENVIRO_PLASTIC: 'enviro',
  MANGETHE: 'mangethe',
  THANDO_KINETICS: 'thando'
};

/** Reserved for the group and supplier portals; never assigned to an SBU. */
export const RESERVED_SUBDOMAINS = ['group', 'suppliers', 'api', 'www'];

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

function subdomainFor(code: string): string {
  return SUBDOMAIN[code] || code.toLowerCase().replace(/_/g, '');
}

async function main(): Promise<void> {
  const base = arg('base');
  const dryRun = process.argv.includes('--dry-run');
  const replace = process.argv.includes('--replace');

  if (!base) {
    throw new Error('--base is required, e.g. --base sourceline.co.zw');
  }
  const baseDomain = base.trim().toLowerCase().replace(/^\.+|\.+$/g, '');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  console.log(`Registry : ${platformDbName()}`);
  console.log(`Base     : ${baseDomain}`);
  if (dryRun) console.log('DRY RUN - nothing will be written');
  console.log();

  const sbus = await Sbu.find({}).sort({ code: 1 });
  if (sbus.length === 0) throw new Error('The SBU registry is empty. Run seed:sbu-registry first.');

  // --dns: report what the registrar needs, change nothing. A wildcard covers
  // every SBU in one record; the per-host list is there for registrars whose
  // DNS panel will not take a wildcard, which several .co.zw resellers will
  // not. Take the record VALUE from what Vercel shows when the domain is added
  // to the project rather than from here — it is the authoritative source and
  // it differs between apex and subdomain records.
  if (process.argv.includes('--dns')) {
    const hosts = (sbus as ISbu[])
      .map((sbu) => subdomainFor(sbu.code))
      .filter((sub) => !RESERVED_SUBDOMAINS.includes(sub))
      .sort();

    console.log('Preferred — one wildcard covers every business unit:\n');
    console.log('  TYPE   NAME   VALUE');
    console.log('  CNAME  *      <target Vercel shows, usually cname.vercel-dns.com>');
    console.log(`  A      @      <apex target Vercel shows for ${baseDomain}>`);

    console.log('\nIf the registrar will not take a wildcard, add these instead:\n');
    console.log('  TYPE   NAME');
    for (const host of [...hosts, ...RESERVED_SUBDOMAINS]) {
      console.log(`  CNAME  ${host}`);
    }

    console.log(`\n${hosts.length} business unit record(s) plus ${RESERVED_SUBDOMAINS.length} reserved.`);
    console.log('\nIn Vercel: add the apex and *.' + baseDomain + ' to the client project,');
    console.log('and api.' + baseDomain + ' to the API project. Then set CLIENT_URL on the API');
    console.log('project to https://' + baseDomain + '.');
    await mongoose.disconnect();
    return;
  }

  const seen = new Map<string, string>();

  for (const sbu of sbus as ISbu[]) {
    const sub = subdomainFor(sbu.code);

    if (RESERVED_SUBDOMAINS.includes(sub)) {
      console.log(`  ! ${sbu.code.padEnd(16)} would take the reserved name "${sub}" — skipped`);
      continue;
    }

    const host = `${sub}.${baseDomain}`;

    // A hostname must identify exactly one SBU; the unique index would reject
    // a clash anyway, but saying which two collided is more use than E11000.
    const clash = seen.get(host);
    if (clash) {
      console.log(`  ! ${sbu.code.padEnd(16)} ${host} already assigned to ${clash} — skipped`);
      continue;
    }
    seen.set(host, sbu.code);

    const existing = sbu.domains || [];
    if (!replace && existing.includes(host)) {
      console.log(`  = ${sbu.code.padEnd(16)} ${host}`);
      continue;
    }

    const next = replace ? [host] : [...new Set([...existing, host])];
    if (dryRun) {
      console.log(`  ~ ${sbu.code.padEnd(16)} ${host}  (dry run)`);
      continue;
    }

    sbu.domains = next;
    await sbu.save();
    console.log(`  + ${sbu.code.padEnd(16)} ${host}`);
  }

  console.log('\nReserved for the group and supplier portals:');
  for (const sub of RESERVED_SUBDOMAINS) console.log(`    ${sub}.${baseDomain}`);

  console.log(
    dryRun
      ? '\nDry run complete.'
      : '\nDomains set. Point these hostnames at the deployment and the login page stops asking.'
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Setting SBU domains failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
