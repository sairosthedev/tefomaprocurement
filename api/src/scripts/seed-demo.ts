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
 * Idempotent: existing records are brought up to standard, not duplicated.
 * The password for every account it creates is printed at the end.
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import { User, Site, Department, SupplierProfile, Item, Inventory } from '../models/index.js';
import { useSbuFromArgs } from '../tenancy/scriptContext.js';
import { getSbu } from '../tenancy/sbuContext.js';

const PASSWORD = 'Test@1234';

const SITES = [
  { code: 'HQ', name: 'Head Office' },
  { code: 'YARD', name: 'Main Yard & Stores' }
];

const DEPARTMENTS = [
  { name: 'Procurement', code: 'PROC', description: 'Procurement & Supply Chain' },
  { name: 'ICT', code: 'ICT', description: 'Information & Communication Technology' },
  { name: 'Finance', code: 'FIN', description: 'Finance & Accounts' },
  { name: 'Stores', code: 'STORES', description: 'Stores & Inventory' },
  { name: 'Operations', code: 'OPS', description: 'Operations' }
];

/** One account per role. `slug` becomes <slug>@<sbu>.test. */
const STAFF = [
  { slug: 'admin', first: 'Ada', last: 'Admin', role: 'admin' as const, dept: null },
  { slug: 'buyer', first: 'Brian', last: 'Buyer', role: 'procurement_officer' as const, dept: 'Procurement' },
  { slug: 'prochead', first: 'Pamela', last: 'Procurement', role: 'department_head' as const, dept: 'Procurement' },
  { slug: 'icthead', first: 'Ian', last: 'Ngwenya', role: 'department_head' as const, dept: 'ICT' },
  { slug: 'opshead', first: 'Olivia', last: 'Dube', role: 'department_head' as const, dept: 'Operations' },
  { slug: 'finance', first: 'Farai', last: 'Finance', role: 'finance' as const, dept: 'Finance' },
  { slug: 'coo', first: 'Chipo', last: 'Operations', role: 'coo' as const, dept: null },
  { slug: 'stores', first: 'Simba', last: 'Stores', role: 'stores_officer' as const, dept: 'Stores' },
  { slug: 'requester', first: 'Rudo', last: 'Requester', role: 'end_user' as const, dept: 'ICT' },
  { slug: 'requester2', first: 'Tendai', last: 'Moyo', role: 'end_user' as const, dept: 'Operations' }
];

const SUPPLIERS = [
  { company: 'TechZone Hardware (Pvt) Ltd', slug: 'techzone', reg: 'DEMO-HW-001', cat: 'ICT-HW', city: 'Harare' },
  { company: 'CodeBridge Solutions', slug: 'codebridge', reg: 'DEMO-SW-002', cat: 'ICT-SW', city: 'Harare' },
  { company: 'ProFix Maintenance', slug: 'profix', reg: 'DEMO-MNT-003', cat: 'ICT-MAINT', city: 'Bulawayo' },
  { company: 'NetLink Telecom', slug: 'netlink', reg: 'DEMO-TEL-004', cat: 'ICT-TELECOM', city: 'Harare' },
  { company: 'Zimplow Industrial Supplies', slug: 'zimplow', reg: 'DEMO-IND-005', cat: 'GENERAL', city: 'Gweru' },
  { company: 'SafeGuard Safety Equipment', slug: 'safeguard', reg: 'DEMO-PPE-006', cat: 'SAFETY', city: 'Harare' }
];

const ITEMS = [
  { code: 'IT-LAP-001', name: 'Business laptop, 16GB RAM', cat: 'ICT Hardware', unit: 'each', cost: 980, qty: 12 },
  { code: 'IT-MON-002', name: 'Monitor, 24 inch', cat: 'ICT Hardware', unit: 'each', cost: 185, qty: 20 },
  { code: 'IT-PRN-003', name: 'Laser printer, mono', cat: 'ICT Hardware', unit: 'each', cost: 420, qty: 3 },
  { code: 'IT-NET-004', name: 'Network switch, 24 port', cat: 'ICT Hardware', unit: 'each', cost: 310, qty: 2 },
  { code: 'ST-PPE-010', name: 'Safety helmet', cat: 'Safety', unit: 'each', cost: 18, qty: 140 },
  { code: 'ST-PPE-011', name: 'Hi-vis vest', cat: 'Safety', unit: 'each', cost: 12, qty: 85 },
  { code: 'ST-PPE-012', name: 'Safety boots', cat: 'Safety', unit: 'pair', cost: 46, qty: 9 },
  { code: 'GN-STA-020', name: 'A4 paper, 80gsm', cat: 'Stationery', unit: 'box', cost: 28, qty: 60 },
  { code: 'GN-CLN-021', name: 'Industrial cleaner, 5L', cat: 'Consumables', unit: 'litre', cost: 15, qty: 4 },
  { code: 'GN-TOOL-022', name: 'Tool kit, 120 piece', cat: 'Tools', unit: 'set', cost: 240, qty: 6 }
];

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  await useSbuFromArgs();
  const sbu = getSbu();
  if (!sbu) throw new Error('Pass --sbu CODE to say which business unit to fill.');
  const domain = `${sbu.code.toLowerCase().replace(/_/g, '-')}.test`;

  console.log(`\nBusiness unit : ${sbu.code}`);
  console.log(`Database      : ${sbu.dbName}`);
  console.log(`Account domain: @${domain}\n`);

  // --- sites ---------------------------------------------------------------
  const sites: Record<string, any> = {};
  for (const s of SITES) {
    let doc = await Site.findOne({ code: s.code, isDeleted: { $ne: true } });
    if (!doc) doc = await Site.create({ ...s, status: 'active' });
    sites[s.code] = doc;
  }
  console.log(`  sites         ${Object.keys(sites).length}`);

  // --- departments ---------------------------------------------------------
  const depts: Record<string, any> = {};
  for (const d of DEPARTMENTS) {
    let doc = await Department.findOne({ code: d.code, isDeleted: { $ne: true } });
    if (!doc) doc = await Department.create({ ...d, status: 'active' });
    depts[d.name] = doc;
  }
  console.log(`  departments   ${Object.keys(depts).length}`);

  // --- staff ---------------------------------------------------------------
  const accounts: Array<{ role: string; email: string }> = [];
  for (const s of STAFF) {
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
    accounts.push({ role: s.dept ? `${s.role} (${s.dept})` : s.role, email });
  }
  console.log(`  staff         ${accounts.length}`);

  // --- suppliers -----------------------------------------------------------
  const supplierLogins: Array<{ company: string; email: string }> = [];
  for (const s of SUPPLIERS) {
    const email = `${s.slug}@${domain}`;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email, password: PASSWORD, firstName: s.company.split(' ')[0],
        lastName: 'Supplier', role: 'supplier', status: 'active', homeSite: sites.HQ._id
      });
    }
    let profile = await SupplierProfile.findOne({ user: user._id, isDeleted: { $ne: true } });
    const eligible = {
      status: 'active' as const,
      // Awarding is gated on both of these; a supplier without them can be
      // invited to quote but never awarded, which stops a test cycle dead.
      kysComplete: true,
      transactability: 'spend_authorized' as const
    };
    if (profile) {
      Object.assign(profile, eligible);
      await profile.save();
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
        categories: [s.cat],
        bankDetails: { bankName: 'CBZ Bank', accountName: s.company, accountNumber: `10${s.reg.slice(-4)}`, branchCode: '61000', accountType: 'current' },
        ...eligible
      });
    }
    supplierLogins.push({ company: s.company, email });
  }
  console.log(`  suppliers     ${supplierLogins.length}`);

  // --- catalogue and stock --------------------------------------------------
  let stocked = 0;
  for (const it of ITEMS) {
    let item = await Item.findOne({ code: it.code, isDeleted: { $ne: true } });
    if (!item) {
      item = await Item.create({
        code: it.code, name: it.name, category: it.cat, unit: it.unit,
        standardCost: it.cost, reorderLevel: Math.max(2, Math.round(it.qty * 0.25)), status: 'active'
      });
    }
    const existing = await Inventory.findOne({ item: item._id, site: sites.YARD._id, isDeleted: { $ne: true } });
    if (!existing) {
      await Inventory.create({
        item: item._id, site: sites.YARD._id,
        quantityOnHand: it.qty, quantityReserved: 0, quantityAvailable: it.qty,
        unitCost: it.cost, totalValue: it.cost * it.qty,
        reorderLevel: Math.max(2, Math.round(it.qty * 0.25))
      });
      stocked += 1;
    }
  }
  console.log(`  catalogue     ${ITEMS.length} items, ${stocked} stocked at ${sites.YARD.code}`);
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
