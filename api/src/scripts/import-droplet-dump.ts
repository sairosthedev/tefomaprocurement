/**
 * Import legacy data from the old Django ERP Postgres dump (droplet_backup.sql)
 * into the Tefoma Procurement MongoDB.
 *
 * Imports: suppliers (+ supplier user accounts), sites, departments.
 * Idempotent: re-running updates existing records instead of duplicating.
 * Every imported document carries the IMPORT_TAG marker in its notes so the
 * batch can be identified (and removed) later.
 *
 * Run:      npx tsx src/scripts/import-droplet-dump.ts [path\to\droplet_backup.sql]
 * Dry run:  npx tsx src/scripts/import-droplet-dump.ts --dry-run
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { User, SupplierProfile, Site, Department } from '../models/index.js';

const IMPORT_TAG = '[imported:droplet_backup 2026-07-13]';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dumpPath =
  args.find((a) => !a.startsWith('--')) ??
  path.join(__dirname, '../../../droplet_backup.sql');

// ---------------------------------------------------------------------------
// Postgres COPY-format parsing
// ---------------------------------------------------------------------------

type Row = Record<string, string | null>;

function unescapeCopyValue(raw: string): string | null {
  if (raw === '\\N') return null;
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\' && i + 1 < raw.length) {
      const n = raw[++i];
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else if (n === '\\') out += '\\';
      else out += n;
    } else {
      out += c;
    }
  }
  return out;
}

function parseCopyBlocks(sqlPath: string, tables: string[]): Map<string, Row[]> {
  const wanted = new Set(tables);
  const result = new Map<string, Row[]>();
  const text = fs.readFileSync(sqlPath, 'utf8');
  const lines = text.split('\n');

  let currentTable: string | null = null;
  let columns: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (currentTable === null) {
      const m = line.match(/^COPY public\.("?)([A-Za-z0-9_]+)\1 \(([^)]+)\) FROM stdin;$/);
      if (m && wanted.has(m[2])) {
        currentTable = m[2];
        columns = m[3].split(',').map((c) => c.trim().replace(/"/g, ''));
        if (!result.has(currentTable)) result.set(currentTable, []);
      }
    } else {
      if (line === '\\.') {
        currentTable = null;
        continue;
      }
      const fields = line.split('\t');
      const row: Row = {};
      columns.forEach((col, i) => {
        row[col] = fields[i] === undefined ? null : unescapeCopyValue(fields[i]);
      });
      result.get(currentTable)!.push(row);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanStr(v: string | null | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  if (!t || /^n\s*[\\/]?\s*a$/i.test(t) || t === '-') return undefined;
  return t;
}

function parseDate(v: string | null | undefined): Date | undefined {
  const t = cleanStr(v);
  if (!t) return undefined;
  const d = new Date(t);
  return isNaN(d.getTime()) ? undefined : d;
}

function looksLikeName(v: string | undefined): boolean {
  return !!v && /[a-zA-Z]{2,}/.test(v) && !/^[+\d\s()-]+$/.test(v);
}

function siteCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Parsing dump: ${dumpPath}`);
  const tables = parseCopyBlocks(dumpPath, [
    'procurement_supplier',
    'procurement_address',
    'procurement_email',
    'procurement_phonenumber',
    'procurement_director',
    'procurement_tradereference',
    'procurement_category',
    'technical_site',
    'dashboard_department'
  ]);
  for (const [t, rows] of tables) console.log(`  ${t}: ${rows.length} rows`);

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fossilprocure';
  await mongoose.connect(mongoUri);
  console.log(`\nConnected to MongoDB (${mongoose.connection.name})${dryRun ? ' [DRY RUN]' : ''}\n`);

  const summary: Record<string, number> = {
    departmentsCreated: 0, departmentsSkipped: 0,
    sitesCreated: 0, sitesSkipped: 0,
    suppliersCreated: 0, suppliersUpdated: 0,
    usersCreated: 0, usersReused: 0
  };

  // --- Departments -----------------------------------------------------
  for (const row of tables.get('dashboard_department') ?? []) {
    const name = cleanStr(row.name);
    if (!name) continue;
    const existing = await Department.findOne({
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      isDeleted: { $ne: true }
    });
    if (existing) { summary.departmentsSkipped++; continue; }
    if (!dryRun) {
      await Department.create({ name, description: `Imported from legacy ERP ${IMPORT_TAG}`, status: 'active' });
    }
    summary.departmentsCreated++;
  }

  // --- Sites ------------------------------------------------------------
  for (const row of tables.get('technical_site') ?? []) {
    const name = cleanStr(row.name);
    if (!name) continue;
    const code = siteCode(name);
    const existing = await Site.findOne({
      $or: [
        { code },
        { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
      ],
      isDeleted: { $ne: true }
    });
    if (existing) { summary.sitesSkipped++; continue; }
    if (!dryRun) {
      await Site.create({
        code,
        name,
        type: /\bHQ\b/i.test(name) ? 'hq' : 'site',
        address: { city: cleanStr(row.location) },
        status: 'active'
      });
    }
    summary.sitesCreated++;
  }

  // --- Suppliers ---------------------------------------------------------
  const categories = new Map<string, string>();
  for (const row of tables.get('procurement_category') ?? []) {
    if (row.id && cleanStr(row.name)) categories.set(row.id, cleanStr(row.name)!);
  }

  const bySupplier = <T extends Row>(rows: T[] | undefined): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) {
      const sid = r.supplier_id;
      if (!sid) continue;
      if (!m.has(sid)) m.set(sid, []);
      m.get(sid)!.push(r);
    }
    return m;
  };

  const addresses = bySupplier(tables.get('procurement_address'));
  const emails = bySupplier(tables.get('procurement_email'));
  const phones = bySupplier(tables.get('procurement_phonenumber'));
  const directors = bySupplier(tables.get('procurement_director'));
  const tradeRefs = bySupplier(tables.get('procurement_tradereference'));

  const usedEmails = new Set<string>();

  for (const row of tables.get('procurement_supplier') ?? []) {
    const companyName = cleanStr(row.full_registered_company_name) ?? cleanStr(row.trading_names);
    const code = cleanStr(row.code);
    if (!companyName || !code) continue;

    const sid = row.id!;
    const supplierEmails = (emails.get(sid) ?? [])
      .map((e) => cleanStr(e.email_address)?.toLowerCase())
      .filter((e): e is string => !!e && EMAIL_RE.test(e));
    const supplierPhones = (phones.get(sid) ?? [])
      .map((p) => cleanStr(p.number))
      .filter((p): p is string => !!p);
    const addr = (addresses.get(sid) ?? [])[0];
    const contactName = cleanStr(row.initial_point_of_contact);

    const directorLines = (directors.get(sid) ?? [])
      .map((d) => cleanStr(d.name))
      .filter(Boolean)
      .map((n) => `Director: ${n}`);

    const notes = [
      `Imported from legacy ERP ${IMPORT_TAG} (legacy id ${sid}, status ${row.status})`,
      ...directorLines
    ].join('\n');

    const contactPersons =
      supplierEmails.length > 0 && supplierPhones.length > 0
        ? [{
            name: looksLikeName(contactName) ? contactName! : companyName,
            email: supplierEmails[0],
            phone: supplierPhones[0],
            isPrimary: true
          }]
        : [];

    const clientReferrals = (tradeRefs.get(sid) ?? [])
      .filter((t) => cleanStr(t.name))
      .map((t) => ({
        clientName: cleanStr(t.name)!,
        contactPhone: cleanStr(t.telephone_number),
        projectDescription: cleanStr(t.amount_of_credit)
          ? `Trade reference — credit amount: ${cleanStr(t.amount_of_credit)}`
          : 'Trade reference'
      }));

    const profileFields = {
      companyName,
      tradingName: cleanStr(row.trading_names),
      registrationNumber: code,
      address: addr
        ? {
            street: cleanStr(addr.street_address),
            city: cleanStr(addr.town_city),
            country: cleanStr(row.country_of_incorporation) ?? 'Zimbabwe'
          }
        : undefined,
      contactPersons,
      bankDetails: cleanStr(row.principal_bankers)
        ? {
            bankName: cleanStr(row.principal_bankers),
            accountName: cleanStr(row.bank_account_name),
            accountNumber: cleanStr(row.bank_account_number)
          }
        : undefined,
      categories: row.category_id && categories.has(row.category_id)
        ? [categories.get(row.category_id)!]
        : [],
      clientReferrals,
      status: row.approved === 't' ? 'active' : 'pending',
      website: cleanStr(row.website),
      incorporationDate: parseDate(row.incorporation_date),
      proposedBusiness: cleanStr(row.services_or_products) ?? cleanStr(row.envisaged_trade_details),
      tradeVolume: cleanStr(row.volume_or_quantity),
      tradeProducts: cleanStr(row.products_or_goods)
        ? [cleanStr(row.products_or_goods)!]
        : [],
      notes
    };

    const existing = await SupplierProfile.findOne({ registrationNumber: code, isDeleted: { $ne: true } });
    if (existing) {
      if (!dryRun) await SupplierProfile.updateOne({ _id: existing._id }, { $set: profileFields });
      summary.suppliersUpdated++;
      continue;
    }

    // Supplier user account. Prefer the supplier's real email; fall back to a
    // synthetic address. Password is random and not stored anywhere — accounts
    // activate via the normal password-reset flow.
    let email = supplierEmails.find((e) => !usedEmails.has(e));
    if (email && !dryRun) {
      const clash = await User.findOne({ email });
      if (clash) email = undefined;
    }
    if (!email) email = `${code.toLowerCase()}@suppliers.imported.local`;
    usedEmails.add(email);

    let nameParts = looksLikeName(contactName) ? contactName!.split(/\s+/) : companyName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || 'Supplier';

    if (!dryRun) {
      let user = await User.findOne({ email, isDeleted: { $ne: true } });
      if (user) {
        summary.usersReused++;
      } else {
        user = await User.create({
          email,
          password: crypto.randomBytes(24).toString('base64url'),
          firstName,
          lastName,
          role: 'supplier',
          phone: supplierPhones[0],
          status: 'active'
        });
        summary.usersCreated++;
      }
      await SupplierProfile.create({ user: user._id, ...profileFields });
    } else {
      summary.usersCreated++;
    }
    summary.suppliersCreated++;
  }

  console.log('\n=== Import summary ===');
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
  if (dryRun) console.log('\nDry run — nothing was written.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
