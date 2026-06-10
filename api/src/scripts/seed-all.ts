/**
 * Seed HQ site, departments, all staff roles, and ICT suppliers.
 * Password for every account: Admin@123
 *
 * Run: npm run seed:all -w api
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { User, Site, Department, SupplierProfile } from '../models/index.js';
import type { IUser } from '../models/User.model.js';

const PASSWORD = 'Admin@123';

const DEPARTMENTS = [
  { name: 'ICT', code: 'ICT', description: 'Information & Communication Technology' },
  { name: 'Procurement', code: 'PROC', description: 'Procurement & Supply Chain' },
  { name: 'Finance', code: 'FIN', description: 'Finance & Accounts' },
  { name: 'Stores', code: 'STORES', description: 'Stores & Inventory' }
] as const;

const STAFF = [
  { email: 'admin@fossilzim.com', firstName: 'System', lastName: 'Admin', role: 'admin' as const },
  { email: 'macdonald@fossilzim.com', firstName: 'Macdonald', lastName: 'Sairo', role: 'procurement_officer' as const, department: 'Procurement' },
  { email: 'jb@fossilzim.com', firstName: 'John', lastName: 'Banda', role: 'department_head' as const, department: 'Procurement' },
  { email: 'mac@fossilzim.com', firstName: 'Mac', lastName: 'Chikwana', role: 'department_head' as const, department: 'ICT' },
  { email: 'paul@fossilzim.com', firstName: 'Paul', lastName: 'Kofa', role: 'finance' as const, department: 'Finance' },
  { email: 'tino@fossilzim.com', firstName: 'Tino', lastName: 'Moyo', role: 'coo' as const },
  { email: 'alfred@fossilzim.com', firstName: 'Alfred', lastName: 'Ncube', role: 'stores_officer' as const, department: 'Stores' },
  { email: 'james@fossilzim.com', firstName: 'James', lastName: 'Mutendi', role: 'end_user' as const, department: 'ICT' }
];

const ICT_SUPPLIERS = [
  {
    companyName: 'TechZone Hardware (Pvt) Ltd',
    tradingName: 'TechZone',
    registrationNumber: 'ICT-2024-001',
    category: 'ICT-HW',
    firstName: 'Tendai',
    lastName: 'Moyo',
    email: 'ict.hw@techzone.co.zw',
    phone: '+263 77 111 0001',
    city: 'Harare',
    province: 'Harare'
  },
  {
    companyName: 'CodeBridge Solutions',
    tradingName: 'CodeBridge',
    registrationNumber: 'ICT-2024-002',
    category: 'ICT-SW',
    firstName: 'Rudo',
    lastName: 'Chikwanha',
    email: 'ict.sw@codebridge.co.zw',
    phone: '+263 77 111 0002',
    city: 'Harare',
    province: 'Harare'
  },
  {
    companyName: 'ProFix ICT Maintenance',
    tradingName: 'ProFix ICT',
    registrationNumber: 'ICT-2024-003',
    category: 'ICT-MAINT',
    firstName: 'Brian',
    lastName: 'Ndlovu',
    email: 'ict.maint@profix.co.zw',
    phone: '+263 77 111 0003',
    city: 'Bulawayo',
    province: 'Bulawayo'
  },
  {
    companyName: 'NetLink Telecom Zimbabwe',
    tradingName: 'NetLink',
    registrationNumber: 'ICT-2024-004',
    category: 'ICT-TELECOM',
    firstName: 'Farai',
    lastName: 'Gumbo',
    email: 'ict.telecom@netlink.co.zw',
    phone: '+263 77 111 0004',
    city: 'Harare',
    province: 'Harare'
  },
  {
    companyName: 'RadioCom Communications',
    tradingName: 'RadioCom',
    registrationNumber: 'ICT-2024-005',
    category: 'ICT-RADIO',
    firstName: 'Kudzai',
    lastName: 'Mutasa',
    email: 'ict.radio@radiocom.co.zw',
    phone: '+263 77 111 0005',
    city: 'Mutare',
    province: 'Manicaland'
  },
  {
    companyName: 'PrecisionCal Instruments',
    tradingName: 'PrecisionCal',
    registrationNumber: 'ICT-2024-006',
    category: 'ICT-CALIB',
    firstName: 'Simbarashe',
    lastName: 'Mukamuri',
    email: 'ict.calib@precisioncal.co.zw',
    phone: '+263 77 111 0006',
    city: 'Gweru',
    province: 'Midlands'
  }
] as const;

async function ensureSite() {
  let hq = await Site.findOne({ code: 'HQ', isDeleted: false });
  if (!hq) {
    hq = await Site.create({
      code: 'HQ',
      name: 'Head Office Stores',
      type: 'hq',
      hasLocalStore: true,
      status: 'active'
    });
    console.log('  + Created HQ site');
  }
  return hq;
}

async function ensureDepartments() {
  const map = new Map<string, mongoose.Types.ObjectId>();
  for (const dept of DEPARTMENTS) {
    let doc = await Department.findOne({ name: dept.name, isDeleted: false });
    if (!doc) {
      doc = await Department.create({ ...dept, status: 'active' });
      console.log(`  + Department: ${dept.name}`);
    }
    map.set(dept.name, doc._id);
  }
  return map;
}

async function ensureUser(
  data: {
    email: string;
    firstName: string;
    lastName: string;
    role: IUser['role'];
    department?: mongoose.Types.ObjectId;
    homeSite?: mongoose.Types.ObjectId;
  }
) {
  const email = data.email.toLowerCase();
  let user = await User.findOne({ email, isDeleted: { $ne: true } }).select('+password');

  if (user) {
    user.password = PASSWORD;
    user.firstName = data.firstName;
    user.lastName = data.lastName;
    user.role = data.role;
    user.status = 'active';
    if (data.department) user.department = data.department;
    if (data.homeSite) user.homeSite = data.homeSite;
    await user.save();
    return { user, created: false };
  }

  user = await User.create({
    email,
    password: PASSWORD,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    department: data.department,
    homeSite: data.homeSite,
    status: 'active'
  });
  return { user, created: true };
}

async function seedAll() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log(`Connected to: ${mongoose.connection.name}\n`);

  const hq = await ensureSite();
  const departments = await ensureDepartments();

  console.log('\nStaff accounts (password: Admin@123):');
  console.log('─'.repeat(72));

  for (const staff of STAFF) {
    const deptId = staff.department ? departments.get(staff.department) : undefined;
    const { user, created } = await ensureUser({
      email: staff.email,
      firstName: staff.firstName,
      lastName: staff.lastName,
      role: staff.role,
      department: deptId,
      homeSite: hq._id
    });

    if (staff.department && deptId) {
      const dept = await Department.findById(deptId);
      if (dept && staff.role === 'department_head') {
        dept.head = user._id;
        await dept.save();
      }
    }

    console.log(`${created ? '+' : '~'} ${staff.role.padEnd(22)} ${staff.email}`);
  }

  console.log('\nSupplier accounts (password: Admin@123):');
  console.log('─'.repeat(72));

  for (const supplier of ICT_SUPPLIERS) {
    const email = supplier.email.toLowerCase();
    const { user, created } = await ensureUser({
      email,
      firstName: supplier.firstName,
      lastName: supplier.lastName,
      role: 'supplier',
      homeSite: hq._id
    });

    const existingProfile = await SupplierProfile.findOne({ user: user._id, isDeleted: { $ne: true } });
    if (existingProfile) {
      existingProfile.status = 'active';
      await existingProfile.save();
      console.log(`~ supplier              ${email}  (${supplier.companyName}) → active`);
    } else {
      await SupplierProfile.create({
        user: user._id,
        companyName: supplier.companyName,
        tradingName: supplier.tradingName,
        registrationNumber: supplier.registrationNumber,
        taxNumber: `TIN-${supplier.registrationNumber}`,
        vatNumber: `VAT-${supplier.registrationNumber}`,
        address: {
          street: `12 ${supplier.city} Industrial Park`,
          city: supplier.city,
          province: supplier.province,
          postalCode: '00263',
          country: 'Zimbabwe'
        },
        contactPersons: [{
          name: `${supplier.firstName} ${supplier.lastName}`,
          position: 'Managing Director',
          email,
          phone: supplier.phone,
          isPrimary: true
        }],
        categories: [supplier.category],
        bankDetails: {
          bankName: 'CBZ Bank',
          accountName: supplier.companyName,
          accountNumber: `1000${supplier.registrationNumber.slice(-3)}`,
          branchCode: '61000',
          accountType: 'current'
        },
        status: 'active'
      });
      console.log(`+ supplier              ${email}  (${supplier.companyName})`);
    }
  }

  console.log('\n' + '─'.repeat(72));
  console.log('All accounts use password: Admin@123');
  console.log('Done.\n');

  await mongoose.disconnect();
  process.exit(0);
}

seedAll().catch((error) => {
  console.error('Seed error:', error);
  process.exit(1);
});
