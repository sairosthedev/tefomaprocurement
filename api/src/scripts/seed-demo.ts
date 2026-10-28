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

const PASSWORD = 'Test@1234';

interface SeedSite {
  code: string;
  name: string;
}
interface SeedDepartment {
  name: string;
  code: string;
  description: string;
}
interface SeedStaff {
  slug: string;
  first: string;
  last: string;
  role: 'admin' | 'procurement_officer' | 'department_head' | 'finance' | 'coo' | 'stores_officer' | 'end_user';
  dept: string | null;
  /** What this person does, for the printed handout. */
  title: string;
}
interface SeedSupplier {
  company: string;
  slug: string;
  reg: string;
  /** Canonical supplier-category codes. Several suppliers share a code on
   *  purpose, so category auto-invitation can reach three without a top-up. */
  cats: string[];
  city: string;
}
interface SeedItem {
  code: string;
  name: string;
  cat: string;
  unit: string;
  cost: number;
  qty: number;
}

interface SeedProfile {
  label: string;
  /** Site holding stock. Must appear in `sites`. */
  storeSite: string;
  sites: SeedSite[];
  departments: SeedDepartment[];
  staff: SeedStaff[];
  suppliers: SeedSupplier[];
  items: SeedItem[];
}

/**
 * A general/ICT business unit — the original shape, used by Dokuma.
 */
const ICT_PROFILE: SeedProfile = {
  label: 'general / ICT',
  storeSite: 'YARD',
  sites: [
    { code: 'HQ', name: 'Head Office' },
    { code: 'YARD', name: 'Main Yard & Stores' }
  ],
  departments: [
    { name: 'Procurement', code: 'PROC', description: 'Procurement & Supply Chain' },
    { name: 'ICT', code: 'ICT', description: 'Information & Communication Technology' },
    { name: 'Finance', code: 'FIN', description: 'Finance & Accounts' },
    { name: 'Stores', code: 'STORES', description: 'Stores & Inventory' },
    { name: 'Operations', code: 'OPS', description: 'Operations' }
  ],
  staff: [
    { slug: 'admin', first: 'Ada', last: 'Admin', role: 'admin', dept: null, title: 'Administrator' },
    { slug: 'buyer', first: 'Brian', last: 'Buyer', role: 'procurement_officer', dept: 'Procurement', title: 'Procurement officer' },
    { slug: 'prochead', first: 'Pamela', last: 'Procurement', role: 'department_head', dept: 'Procurement', title: 'Head of Procurement' },
    { slug: 'icthead', first: 'Ian', last: 'Ngwenya', role: 'department_head', dept: 'ICT', title: 'Head of ICT' },
    { slug: 'opshead', first: 'Olivia', last: 'Dube', role: 'department_head', dept: 'Operations', title: 'Head of Operations' },
    { slug: 'finance', first: 'Farai', last: 'Finance', role: 'finance', dept: 'Finance', title: 'Finance' },
    { slug: 'coo', first: 'Chipo', last: 'Operations', role: 'coo', dept: null, title: 'COO' },
    { slug: 'stores', first: 'Simba', last: 'Stores', role: 'stores_officer', dept: 'Stores', title: 'Stores officer' },
    { slug: 'requester', first: 'Rudo', last: 'Requester', role: 'end_user', dept: 'ICT', title: 'End user — ICT' },
    { slug: 'requester2', first: 'Tendai', last: 'Moyo', role: 'end_user', dept: 'Operations', title: 'End user — Operations' }
  ],
  suppliers: [
    { company: 'TechZone Hardware (Pvt) Ltd', slug: 'techzone', reg: 'DEMO-HW-001', cats: ['ICT-HW'], city: 'Harare' },
    { company: 'CodeBridge Solutions', slug: 'codebridge', reg: 'DEMO-SW-002', cats: ['ICT-SW'], city: 'Harare' },
    { company: 'ProFix Maintenance', slug: 'profix', reg: 'DEMO-MNT-003', cats: ['ICT-MAINT'], city: 'Bulawayo' },
    { company: 'NetLink Telecom', slug: 'netlink', reg: 'DEMO-TEL-004', cats: ['ICT-TELECOM'], city: 'Harare' },
    { company: 'Zimplow Industrial Supplies', slug: 'zimplow', reg: 'DEMO-IND-005', cats: ['GENERAL'], city: 'Gweru' },
    { company: 'SafeGuard Safety Equipment', slug: 'safeguard', reg: 'DEMO-PPE-006', cats: ['SAFETY'], city: 'Harare' }
  ],
  items: [
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
  ]
};

/**
 * A construction contractor — used by Fossil.
 *
 * Differs from the ICT profile in the ways that matter for testing a
 * contractor's procurement: departments are the ones a site actually runs
 * through (contracts, plant, quantity surveying, SHEQ), stock is materials and
 * plant consumables rather than office equipment, and there is a live project
 * site as well as a yard, so site-scoped requisitions have somewhere to come
 * from.
 *
 * Three suppliers share BUILD-MAT and three share IND-PLANT, deliberately: the
 * category auto-invitation reaches the minimum of three quotations from exact
 * matches alone, so the ranking engine can be exercised on a real contest
 * rather than on a related-category top-up.
 */
const CONSTRUCTION_PROFILE: SeedProfile = {
  label: 'construction contractor',
  storeSite: 'YARD',
  sites: [
    { code: 'HQ', name: 'Head Office' },
    { code: 'YARD', name: 'Plant Yard & Central Stores' },
    { code: 'SITE-BOR', name: 'Borrowdale Housing Project' }
  ],
  departments: [
    { name: 'Procurement', code: 'PROC', description: 'Procurement & Supply Chain' },
    { name: 'Contracts & Projects', code: 'PROJ', description: 'Site delivery, contracts administration' },
    { name: 'Plant & Equipment', code: 'PLANT', description: 'Plant, fleet and workshop' },
    { name: 'Quantity Surveying', code: 'QS', description: 'Measurement, valuations and cost control' },
    { name: 'SHEQ', code: 'SHEQ', description: 'Safety, Health, Environment & Quality' },
    { name: 'Finance', code: 'FIN', description: 'Finance & Accounts' },
    { name: 'Stores', code: 'STORES', description: 'Stores & Inventory' }
  ],
  staff: [
    { slug: 'admin', first: 'Ada', last: 'Admin', role: 'admin', dept: null, title: 'Administrator' },
    { slug: 'buyer', first: 'Brian', last: 'Buyer', role: 'procurement_officer', dept: 'Procurement', title: 'Procurement officer' },
    { slug: 'prochead', first: 'Pamela', last: 'Procurement', role: 'department_head', dept: 'Procurement', title: 'Head of Procurement' },
    { slug: 'projhead', first: 'Patience', last: 'Chikore', role: 'department_head', dept: 'Contracts & Projects', title: 'Contracts Manager' },
    { slug: 'planthead', first: 'Peter', last: 'Nyoni', role: 'department_head', dept: 'Plant & Equipment', title: 'Plant Manager' },
    { slug: 'qshead', first: 'Qeda', last: 'Mhlanga', role: 'department_head', dept: 'Quantity Surveying', title: 'Senior Quantity Surveyor' },
    { slug: 'sheqhead', first: 'Shamiso', last: 'Banda', role: 'department_head', dept: 'SHEQ', title: 'SHEQ Manager' },
    { slug: 'finance', first: 'Farai', last: 'Finance', role: 'finance', dept: 'Finance', title: 'Finance' },
    { slug: 'coo', first: 'Chipo', last: 'Operations', role: 'coo', dept: null, title: 'COO' },
    { slug: 'stores', first: 'Simba', last: 'Stores', role: 'stores_officer', dept: 'Stores', title: 'Stores officer' },
    { slug: 'requester', first: 'Rudo', last: 'Site', role: 'end_user', dept: 'Contracts & Projects', title: 'End user — Site Agent' },
    { slug: 'requester2', first: 'Tendai', last: 'Moyo', role: 'end_user', dept: 'Plant & Equipment', title: 'End user — Plant Foreman' }
  ],
  suppliers: [
    // Construction materials — three competitors, so an RFQ for materials
    // reaches the three-quotation minimum on exact matches alone.
    { company: 'Mutare Quarry & Aggregates', slug: 'mutarequarry', reg: 'FOS-MAT-001', cats: ['BUILD-MAT'], city: 'Mutare' },
    { company: 'Hunyani Sand & Stone', slug: 'hunyanisand', reg: 'FOS-MAT-002', cats: ['BUILD-MAT'], city: 'Harare' },
    { company: 'Zimbabwe Cement Supplies', slug: 'zimcement', reg: 'FOS-MAT-003', cats: ['BUILD-MAT'], city: 'Gweru' },
    // Plant hire and maintenance — another three-way contest.
    { company: 'Harare Plant Hire', slug: 'harareplant', reg: 'FOS-PLT-004', cats: ['IND-PLANT', 'IND-MAINT'], city: 'Harare' },
    { company: 'Kopje Earthmoving Equipment', slug: 'kopjeplant', reg: 'FOS-PLT-005', cats: ['IND-PLANT'], city: 'Bulawayo' },
    { company: 'Midlands Plant & Compressors', slug: 'midlandsplant', reg: 'FOS-PLT-006', cats: ['IND-PLANT', 'IND-COMPRESS'], city: 'Gweru' },
    // Trades and specialist works.
    { company: 'Steelmakers Fabrication', slug: 'steelmakers', reg: 'FOS-STL-007', cats: ['BUILD-MECH', 'IND-TOOLS'], city: 'Harare' },
    { company: 'PipeCo Zimbabwe', slug: 'pipeco', reg: 'FOS-PIP-008', cats: ['BUILD-PIPE', 'BUILD-PLUMB'], city: 'Harare' },
    { company: 'Timberline Lumber & Boards', slug: 'timberline', reg: 'FOS-TIM-009', cats: ['BUILD-TIMBER'], city: 'Mutare' },
    { company: 'Borehole Masters', slug: 'boreholemasters', reg: 'FOS-BOR-010', cats: ['BUILD-BOREHOLE'], city: 'Harare' },
    { company: 'Civils Contracting Zimbabwe', slug: 'civilszim', reg: 'FOS-CIV-011', cats: ['BUILD-CIVIL'], city: 'Harare' },
    // Consumables a site burns through.
    { company: 'SafeGuard Safety Equipment', slug: 'safeguard', reg: 'FOS-PPE-012', cats: ['SEC-PROTECT'], city: 'Harare' },
    { company: 'Redan Fuels & Lubricants', slug: 'redanfuels', reg: 'FOS-FUE-013', cats: ['CHEM-FUEL', 'CHEM-LUB'], city: 'Harare' }
  ],
  items: [
    // Materials. Several sit below their reorder level on purpose.
    { code: 'MAT-CEM-001', name: 'Cement, 42.5N, 50kg bag', cat: 'Construction Materials', unit: 'bag', cost: 11, qty: 180 },
    { code: 'MAT-SND-002', name: 'River sand, washed', cat: 'Construction Materials', unit: 'cubic metre', cost: 24, qty: 40 },
    { code: 'MAT-STN-003', name: 'Concrete stone, 19mm', cat: 'Construction Materials', unit: 'cubic metre', cost: 32, qty: 12 },
    { code: 'MAT-BRK-004', name: 'Common brick, standard', cat: 'Construction Materials', unit: 'each', cost: 0.18, qty: 24000 },
    { code: 'MAT-REO-005', name: 'Reinforcing bar, Y12, 6m', cat: 'Construction Materials', unit: 'each', cost: 9.4, qty: 65 },
    { code: 'MAT-WIR-006', name: 'Brickforce wire, 150mm x 20m', cat: 'Construction Materials', unit: 'roll', cost: 6.5, qty: 8 },
    { code: 'MAT-PLY-007', name: 'Shutter ply, 18mm, 2440x1220', cat: 'Construction Materials', unit: 'sheet', cost: 42, qty: 14 },
    { code: 'MAT-TIM-008', name: 'Pine timber, 38 x 114mm, 4.2m', cat: 'Timber', unit: 'each', cost: 13.8, qty: 90 },
    { code: 'MAT-PIP-009', name: 'HDPE pipe, 50mm, class 10', cat: 'Pipes & Fittings', unit: 'metre', cost: 3.2, qty: 300 },
    // Plant consumables.
    { code: 'PLT-DSL-020', name: 'Diesel 50ppm', cat: 'Fuels & Lubricants', unit: 'litre', cost: 1.56, qty: 4200 },
    { code: 'PLT-OIL-021', name: 'Hydraulic oil, 68, 20L', cat: 'Fuels & Lubricants', unit: 'each', cost: 58, qty: 6 },
    { code: 'PLT-GRS-022', name: 'Grease, EP2, 18kg', cat: 'Fuels & Lubricants', unit: 'each', cost: 74, qty: 3 },
    { code: 'PLT-BLD-023', name: 'Grader blade, 8ft', cat: 'Plant Spares', unit: 'each', cost: 310, qty: 2 },
    // PPE.
    { code: 'PPE-HLM-030', name: 'Safety helmet', cat: 'Protective Clothing', unit: 'each', cost: 18, qty: 140 },
    { code: 'PPE-VST-031', name: 'Hi-vis vest', cat: 'Protective Clothing', unit: 'each', cost: 12, qty: 85 },
    { code: 'PPE-BTS-032', name: 'Safety boots, steel toe', cat: 'Protective Clothing', unit: 'pair', cost: 46, qty: 9 },
    { code: 'PPE-HRN-033', name: 'Full-body harness, double lanyard', cat: 'Protective Clothing', unit: 'each', cost: 96, qty: 4 }
  ]
};

const PROFILES: Record<string, SeedProfile> = {
  ict: ICT_PROFILE,
  construction: CONSTRUCTION_PROFILE
};

/**
 * Which profile a business unit gets.
 *
 * Fossil is the group's contracting arm, so it is seeded as one. Anything else
 * falls back to the general profile, and `--profile` overrides either way.
 */
function profileFor(sbuCode: string): { key: string; profile: SeedProfile } {
  const flagIndex = process.argv.indexOf('--profile');
  const requested = flagIndex > -1 ? process.argv[flagIndex + 1] : undefined;

  if (requested) {
    const found = PROFILES[requested.toLowerCase()];
    if (!found) {
      throw new Error(
        `Unknown --profile "${requested}". Choose one of: ${Object.keys(PROFILES).join(', ')}.`
      );
    }
    return { key: requested.toLowerCase(), profile: found };
  }

  const key = sbuCode.toUpperCase() === 'FOSSIL' ? 'construction' : 'ict';
  return { key, profile: PROFILES[key]! };
}

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
