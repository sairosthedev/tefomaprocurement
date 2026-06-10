import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Destructive: drops every collection in the connected database.
 * Guarded by a required --yes flag so it can never run accidentally.
 *
 * Usage:
 *   npm run db:wipe -- --yes
 */
const wipeDatabase = async () => {
  const confirmed = process.argv.includes('--yes');
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not set in api/.env');
    process.exit(1);
  }

  if (!confirmed) {
    console.error('⚠️  This will PERMANENTLY DELETE ALL DATA in the connected database.');
    console.error('    Re-run with the --yes flag to proceed:  npm run db:wipe -- --yes');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    const dbName = mongoose.connection.name;
    console.log(`📦 Connected to MongoDB database: ${dbName}`);

    const collections = await mongoose.connection.db!.listCollections().toArray();

    if (collections.length === 0) {
      console.log('ℹ️  Database is already empty. Nothing to do.');
      process.exit(0);
    }

    console.log(`🧹 Clearing ${collections.length} collection(s)...`);
    for (const { name } of collections) {
      const { deletedCount } = await mongoose.connection.db!.collection(name).deleteMany({});
      console.log(`   - ${name}: removed ${deletedCount} document(s)`);
    }

    console.log('\n✅ Database cleaned successfully.');
    console.log('   Run "npm run seed" to recreate the HQ site and admin user.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Wipe error:', error);
    process.exit(1);
  }
};

wipeDatabase();
