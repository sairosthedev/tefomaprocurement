const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { User, Department } = require('../models');

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fossilprocure';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@fossil.co.za' });
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      process.exit(0);
    }

    // Create departments
    const departments = await Department.insertMany([
      { name: 'Administration', code: 'ADMIN', description: 'Administrative department' },
      { name: 'Finance', code: 'FIN', description: 'Finance and accounts' },
      { name: 'Operations', code: 'OPS', description: 'Operations department' },
      { name: 'Procurement', code: 'PROC', description: 'Procurement and sourcing' },
      { name: 'Stores', code: 'STR', description: 'Stores and inventory' },
    ]);
    console.log('✅ Created departments');

    const adminDept = departments.find(d => d.code === 'ADMIN');
    const financeDept = departments.find(d => d.code === 'FIN');
    const procDept = departments.find(d => d.code === 'PROC');
    const storesDept = departments.find(d => d.code === 'STR');
    const opsDept = departments.find(d => d.code === 'OPS');

    // Create users
    const users = await User.create([
      {
        email: 'admin@fossilzim.com',
        password: 'Admin@123',
        firstName: 'System',
        lastName: 'Admin',
        role: 'admin',
        department: adminDept._id,
        status: 'active'
      },
      {
        email: 'procurement@fossilzim.com',
        password: 'Admin@123',
        firstName: 'John',
        lastName: 'Procurement',
        role: 'procurement_officer',
        department: procDept._id,
        status: 'active'
      },
      {
        email: 'finance@fossilzim.com',
        password: 'Admin@123',
        firstName: 'Jane',
        lastName: 'Finance',
        role: 'finance',
        department: financeDept._id,
        status: 'active'
      },
      {
        email: 'coo@fossilzim.com',
        password: 'Admin@123',
        firstName: 'Peter',
        lastName: 'COO',
        role: 'coo',
        department: adminDept._id,
        status: 'active'
      },
      {
        email: 'stores@fossilzim.com',
        password: 'Admin@123',
        firstName: 'Sarah',
        lastName: 'Stores',
        role: 'stores_officer',
        department: storesDept._id,
        status: 'active'
      },
      {
        email: 'depthead@fossilzim.com',
        password: 'Admin@123',
        firstName: 'Mike',
        lastName: 'Operations',
        role: 'department_head',
        department: opsDept._id,
        status: 'active'
      }
    ]);

    console.log('✅ Created users:');
    console.log('   - admin@fossilzim.com / Admin@123 (Admin)');
    console.log('   - procurement@fossilzim.com / Proc@123 (Procurement Officer)');
    console.log('   - finance@fossilzim.com / Finance@123 (Finance)');
    console.log('   - coo@fossilzim.com / Coo@123 (COO)');
    console.log('   - stores@fossilzim.com / Stores@123 (Stores Officer)');
    console.log('   - depthead@fossilzim.com / Dept@123 (Department Head)');

    console.log('\n🎉 Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();

