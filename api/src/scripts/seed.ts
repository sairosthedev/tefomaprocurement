import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { User, Site } from '../models/index.js';

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fossilprocure';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');

    let hq = await Site.findOne({ code: 'HQ', isDeleted: false });
    if (!hq) {
      hq = await Site.create({
        code: 'HQ',
        name: 'Head Office Stores',
        type: 'hq',
        hasLocalStore: true,
        status: 'active'
      });
      console.log('Created HQ site');
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@fossilzim.com' });
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      process.exit(0);
    }

    // Create admin user only
    const adminUser = await User.create({
      email: 'admin@fossilzim.com',
      password: 'Admin@123',
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin',
      homeSite: hq._id,
      status: 'active'
    });

    console.log('✅ Created admin user:');
    console.log('   - admin@fossilzim.com / Admin@123 (Admin)');

    console.log('\n🎉 Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();

/*  */
