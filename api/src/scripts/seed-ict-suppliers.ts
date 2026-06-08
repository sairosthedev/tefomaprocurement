/**
 * Seed 6 ICT-related supplier accounts for testing.
 * Run: npm run seed:ict-suppliers -w api
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { User, SupplierProfile } from '../models/index.js';

const PASSWORD = 'Supplier@123';

const ICT_SUPPLIERS = [
  {
    companyName: 'TechZone Hardware (Pvt) Ltd',
    tradingName: 'TechZone',
    registrationNumber: 'ICT-2024-001',
    category: 'ICT-HW',
    categoryLabel: 'Computers, Printers & Networking',
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
    categoryLabel: 'Software Development & Cybersecurity',
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
    categoryLabel: 'ICT Equipment Maintenance & Repair',
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
    categoryLabel: 'Telecommunications & Internet Systems',
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
    categoryLabel: 'Radios, Mobile Phones & Communication Accessories',
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
    categoryLabel: 'Calibration of Equipment',
    firstName: 'Simbarashe',
    lastName: 'Mukamuri',
    email: 'ict.calib@precisioncal.co.zw',
    phone: '+263 77 111 0006',
    city: 'Gweru',
    province: 'Midlands'
  }
] as const;

async function seedIctSuppliers(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fossilprocure';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB\n');

  const created: Array<{ company: string; category: string; email: string; password: string }> = [];
  const skipped: string[] = [];

  for (const supplier of ICT_SUPPLIERS) {
    const email = supplier.email.toLowerCase();

    const existingUser = await User.findOne({ email, isDeleted: { $ne: true } });
    if (existingUser) {
      skipped.push(`${supplier.companyName} (${email}) — already exists`);
      continue;
    }

    const user = await User.create({
      email,
      password: PASSWORD,
      firstName: supplier.firstName,
      lastName: supplier.lastName,
      role: 'supplier',
      phone: supplier.phone,
      status: 'active'
    });

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
      status: 'pending'
    });

    created.push({
      company: supplier.companyName,
      category: `${supplier.category} — ${supplier.categoryLabel}`,
      email,
      password: PASSWORD
    });
  }

  if (created.length > 0) {
    console.log(`Created ${created.length} ICT supplier(s):\n`);
    console.log('─'.repeat(80));
    for (const row of created) {
      console.log(`Company:    ${row.company}`);
      console.log(`Category:   ${row.category}`);
      console.log(`Email:      ${row.email}`);
      console.log(`Password:   ${row.password}`);
      console.log('─'.repeat(80));
    }
  }

  if (skipped.length > 0) {
    console.log('\nSkipped (already exist):');
    skipped.forEach((s) => console.log(`  - ${s}`));
  }

  if (created.length === 0 && skipped.length === ICT_SUPPLIERS.length) {
    console.log('All 6 ICT suppliers already exist. Credentials (same password for all):');
    console.log('─'.repeat(80));
    for (const supplier of ICT_SUPPLIERS) {
      console.log(`${supplier.companyName}`);
      console.log(`  Email:    ${supplier.email}`);
      console.log(`  Password: ${PASSWORD}`);
      console.log(`  Category: ${supplier.category}`);
      console.log('─'.repeat(80));
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

seedIctSuppliers().catch((error) => {
  console.error('Seed error:', error);
  process.exit(1);
});
