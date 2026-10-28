/**
 * Demo data for testing a business unit.
 *
 * Creates everything a tester needs to exercise the procurement cycle: sites,
 * departments, one account per role, award-eligible suppliers, a catalogue and
 * stock on hand.
 *
 * Accounts are named for the business unit — hod@dokuma.test, not a shared
 * address — because a tester moving between two units otherwise cannot tell
 * which one they are signed in to, and the same inbox in both is how test
 * findings get filed against the wrong unit.
 *
 *   npm run seed:demo -- --sbu DOKUMA
 *   npm run seed:demo -- --sbu FOSSIL
 *
 * What gets created depends on the business profile. Fossil is the group's
 * contracting arm, so it is seeded as a construction contractor — site and
 * plant departments, materials and plant stock, suppliers in the building
 * trades. Everything else gets the general/ICT shape. Override with
 * `--profile construction` or `--profile ict`.
 *
 * Idempotent: existing records are brought up to standard, not duplicated.
 * It does not remove anything, so re-seeding a unit under a different profile
 * leaves the earlier profile's records in place alongside the new ones — use
 * `migrate:sbu-reset` first if you want a clean unit.
 *
 * The password for every account it creates is printed at the end.
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import { User, Site, Department, SupplierProfile, Item, Inventory } from '../models/index.js';
import { useSbuFromArgs } from '../tenancy/scriptContext.js';
import { getSbu } from '../tenancy/sbuContext.js';
import { profileFor } from './demoProfiles.js';

const PASSWORD = 'Test@1234';

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  await useSbuFromArgs();
  const sbu = getSbu();
  if (!sbu) throw new Error('Pass --sbu CODE to say which business unit to fill.');
  const domain = `${sbu.code.toLowerCase().replace(/_/g, '-')}.test`;

  const { key: profileKey, profile } = profileFor(sbu.code);

  console.log(`\nBusiness unit : ${sbu.code}`);
  console.log(`Database      : ${sbu.dbName}`);
  console.log(`Account domain: @${domain}`);
  console.log(`Profile       : ${profileKey} (${profile.label})\n`);

  // --- sites ---------------------------------------------------------------
  const sites: Record<string, any> = {};
  for (const s of profile.sites) {
    let doc = await Site.findOne({ code: s.code, isDeleted: { $ne: true } });
    if (!doc) doc = await Site.create({ ...s, status: 'active' });
    sites[s.code] = doc;
  }
  console.log(`  sites         ${Object.keys(sites).length}`);

  // --- departments ---------------------------------------------------------
  const depts: Record<string, any> = {};
  for (const d of profile.departments) {
    let doc = await Department.findOne({ code: d.code, isDeleted: { $ne: true } });
    if (!doc) doc = await Department.create({ ...d, status: 'active' });
    depts[d.name] = doc;
  }
  console.log(`  departments   ${Object.keys(depts).length}`);

  // --- staff ---------------------------------------------------------------
  const accounts: Array<{ role: string; email: string }> = [];
  for (const s of profile.staff) {
    const email = `${s.slug}@${domain}`;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        password: PASSWORD,
        firstName: s.first,
        lastName: s.last,
        role: s.role,
        status: 'active',
        homeSite: sites.HQ._id,
        ...(s.dept ? { department: depts[s.dept]._id } : {})
      });
    } else {
      user.status = 'active';
      if (s.dept) user.department = depts[s.dept]._id;
      await user.save();
    }
    accounts.push({ role: s.dept ? `${s.title} (${s.dept})` : s.title, email });
  }
  console.log(`  staff         ${accounts.length}`);

  // --- suppliers -----------------------------------------------------------
  const supplierLogins: Array<{ company: string; email: string }> = [];
  for (const s of profile.suppliers) {
    const email = `${s.slug}@${domain}`;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email, password: PASSWORD, firstName: s.company.split(' ')[0],
        lastName: 'Supplier', role: 'supplier', status: 'active', homeSite: sites.HQ._id
      });
    }
    let supplierProfile = await SupplierProfile.findOne({ user: user._id, isDeleted: { $ne: true } });
    const eligible = {
      status: 'active' as const,
      // Awarding is gated on both of these; a supplier without them can be
      // invited to quote but never awarded, which stops a test cycle dead.
      kysComplete: true,
      transactability: 'spend_authorized' as const
    };
    if (supplierProfile) {
      // Categories are refreshed too: re-seeding a unit under a different
      // profile must move its suppliers onto the new codes, or category
      // auto-invitation goes on matching the old trade.
      Object.assign(supplierProfile, eligible, { categories: s.cats });
      await supplierProfile.save();
    } else {
      await SupplierProfile.create({
        user: user._id,
        companyName: s.company,
        tradingName: s.company.split(' ')[0],
        registrationNumber: s.reg,
        taxNumber: `TIN-${s.reg}`,
        vatNumber: `VAT-${s.reg}`,
        address: { street: `1 ${s.city} Industrial Park`, city: s.city, province: s.city, country: 'Zimbabwe' },
        contactPersons: [{ name: s.company, position: 'Sales', email, phone: '+263 77 000 0000', isPrimary: true }],
        categories: s.cats,
        bankDetails: { bankName: 'CBZ Bank', accountName: s.company, accountNumber: `10${s.reg.slice(-4)}`, branchCode: '61000', accountType: 'current' },
        ...eligible
      });
    }
    supplierLogins.push({ company: s.company, email });
  }
  console.log(`  suppliers     ${supplierLogins.length}`);

  // --- catalogue and stock --------------------------------------------------
  let stocked = 0;
  for (const it of profile.items) {
    let item = await Item.findOne({ code: it.code, isDeleted: { $ne: true } });
    if (!item) {
      item = await Item.create({
        code: it.code, name: it.name, category: it.cat, unit: it.unit,
        standardCost: it.cost, reorderLevel: Math.max(2, Math.round(it.qty * 0.25)), status: 'active'
      });
    }
    const existing = await Inventory.findOne({ item: item._id, site: sites[profile.storeSite]._id, isDeleted: { $ne: true } });
    if (!existing) {
      await Inventory.create({
        item: item._id, site: sites[profile.storeSite]._id,
        quantityOnHand: it.qty, quantityReserved: 0, quantityAvailable: it.qty,
        unitCost: it.cost, totalValue: it.cost * it.qty,
        reorderLevel: Math.max(2, Math.round(it.qty * 0.25))
      });
      stocked += 1;
    }
  }
  console.log(`  catalogue     ${profile.items.length} items, ${stocked} stocked at ${sites[profile.storeSite].code}`);
  console.log('  (some items are deliberately below their reorder level, so low-stock alerts have something to show)');

  console.log('\n' + '='.repeat(74));
  console.log(`ACCOUNTS FOR ${sbu.code} — every password is: ${PASSWORD}`);
  console.log('='.repeat(74));
  for (const a of accounts) console.log(`  ${a.role.padEnd(34)} ${a.email}`);
  console.log('  ' + '-'.repeat(70));
  for (const s of supplierLogins) console.log(`  ${('supplier — ' + s.company).padEnd(34)} ${s.email}`);
  console.log('='.repeat(74));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('\nSeeding demo data failed:', error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
