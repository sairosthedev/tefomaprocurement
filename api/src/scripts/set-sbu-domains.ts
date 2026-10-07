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
 *
 * --check resolves each hostname and reports which are live, so the DNS can be
 * confirmed before anyone tries to sign in:
 *
 *   npm run sbu:domains -- --base sourceline.co.zw --check
 *
 * --only limits every mode to named business units, for going live in waves
 * or when the registrar caps how many records can be added:
 *
 *   npm run sbu:domains -- --base sourceline.co.zw --only FOSSIL,DOKUMA --dns
 *
 * An SBU without a hostname is not cut off — it is reached by choosing it on
 * the login page, exactly as every SBU is today.
 */
import mongoose from 'mongoose';
import dns from 'node:dns/promises';
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

/**
 * Ours, but not an SBU's: the group and supplier portals, the API, and the
 * bare www. These do need DNS records pointing at the deployment.
 */
export const PORTAL_SUBDOMAINS = ['group', 'suppliers', 'api', 'www'];

/**
 * Created by the hosting account for mail and account services.
 *
 * These must keep pointing wherever the host put them. Sending `mail` or
 * `webmail` to the deployment would take the group's email down, so they are
 * listed to be left alone, not to be configured.
 */
export const HOST_SERVICE_SUBDOMAINS = [
  'mail',
  'webmail',
  'cpanel',
  'webdisk',
  'autoconfig',
  'autodiscover',
  'cpcalendars',
  'cpcontacts',
  'ftp',
  'ns1',
  'ns2'
];

/** Never assigned to an SBU, for either reason. */
export const RESERVED_SUBDOMAINS = [...PORTAL_SUBDOMAINS, ...HOST_SERVICE_SUBDOMAINS];

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

  let sbus = await Sbu.find({}).sort({ code: 1 });
  if (sbus.length === 0) throw new Error('The SBU registry is empty. Run seed:sbu-registry first.');

  const only = arg('only');
  if (only) {
    const wanted = new Set(only.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean));
    const found = new Set(sbus.map((sbu) => sbu.code));
    const missing = [...wanted].filter((code) => !found.has(code));
    if (missing.length > 0) {
      throw new Error(`Not in the registry: ${missing.join(', ')}`);
    }
    sbus = sbus.filter((sbu) => wanted.has(sbu.code));
    console.log(`Limited to ${sbus.length} business unit(s): ${sbus.map((s2) => s2.code).join(', ')}\n`);
  }

  // --check: resolve every hostname and say which are live. Writes nothing.
  // The apex is checked first, because when the domain itself is not delegated
  // every subdomain fails for that one reason and the per-host list is noise.
  if (process.argv.includes('--check')) {
    const apex = await dns.resolve4(baseDomain).then(
      (addresses) => addresses.join(', '),
      () => null
    );

    if (!apex) {
      console.log(`  ✗ ${baseDomain} does not resolve.`);
      console.log('\n    The domain itself is not in public DNS, so no subdomain can work.');
      console.log('    Check with the registrar that it is delegated in the .co.zw zone —');
      console.log('    being marked Active in a billing panel is not the same thing.');
      await mongoose.disconnect();
      return;
    }
    console.log(`  ✓ ${baseDomain} -> ${apex}\n`);

    const hosts = (sbus as ISbu[])
      .map((sbu) => subdomainFor(sbu.code))
      .filter((sub) => !RESERVED_SUBDOMAINS.includes(sub))
      .sort();

    let live = 0;
    for (const host of [...hosts, ...PORTAL_SUBDOMAINS]) {
      const fqdn = `${host}.${baseDomain}`;
      const target = await dns.resolveCname(fqdn).then(
        (records) => records.join(', '),
        () => dns.resolve4(fqdn).then((addresses) => addresses.join(', '), () => null)
      );
      if (target) live += 1;
      console.log(`  ${target ? '✓' : '✗'} ${fqdn.padEnd(36)} ${target || 'does not resolve'}`);
    }

    const total = hosts.length + PORTAL_SUBDOMAINS.length;
    console.log(`\n${live} of ${total} hostname(s) resolve.`);
    if (live < total) {
      console.log('A wildcard record would cover the missing ones in a single entry.');
    }
    await mongoose.disconnect();
    return;
  }

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

    // Whether the apex can be repointed at all depends on where mail goes.
    // An MX that names the domain itself means inbound mail is delivered to
    // whatever the apex A record resolves to, so moving that record to the
    // deployment silently stops the domain receiving email.
    const mx = await dns.resolveMx(baseDomain).then(
      (records) => records.map((r) => r.exchange.replace(/\.$/, '').toLowerCase()),
      () => [] as string[]
    );
    const apexCarriesMail = mx.includes(baseDomain);

    console.log('Preferred — one wildcard covers every business unit:\n');
    console.log('  TYPE   NAME   VALUE');
    console.log('  CNAME  *      <target Vercel shows, usually cname.vercel-dns.com>');

    if (apexCarriesMail) {
      console.log(`  A      @      LEAVE ALONE — currently carries this domain's mail`);
      console.log('');
      console.log(`  !! MX for ${baseDomain} points at ${baseDomain} itself, so inbound mail`);
      console.log('     is delivered to whatever the apex A record resolves to. Repointing');
      console.log('     that record at the deployment would stop the domain receiving email.');
      console.log('');
      console.log('     The business units are all on subdomains, so nothing here needs the');
      console.log('     apex. To serve the apex later, first give mail its own host:');
      console.log(`       1. A     mail.${baseDomain}  -> the current apex IP`);
      console.log(`       2. MX    @                   -> mail.${baseDomain}`);
      console.log('       3. check SPF still names that host, then repoint the apex A');
    } else {
      console.log(`  A      @      <apex target Vercel shows for ${baseDomain}>`);
    }

    console.log('\nIf the registrar will not take a wildcard, add these instead:\n');
    console.log('  TYPE   NAME');
    for (const host of [...hosts, ...PORTAL_SUBDOMAINS]) {
      console.log(`  CNAME  ${host}`);
    }

    console.log('\nLeave these exactly as the hosting account set them — they carry');
    console.log('email and control-panel access, and pointing them at the deployment');
    console.log('would take the group off email:\n');
    console.log(`  ${HOST_SERVICE_SUBDOMAINS.join(', ')}`);
    console.log('\nMX and any SPF/DKIM/DMARC TXT records stay untouched for the same reason.');

    console.log(`\n${hosts.length} business unit record(s) plus ${PORTAL_SUBDOMAINS.length} portal record(s).`);
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
