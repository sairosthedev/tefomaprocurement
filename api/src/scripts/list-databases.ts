import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) process.exit(1);

const run = async () => {
  await mongoose.connect(mongoUri);
  const admin = mongoose.connection.db!.admin();
  const { databases } = await admin.listDatabases();
  for (const db of databases) {
    console.log(`${db.name}: ${((db.sizeOnDisk ?? 0) / 1024).toFixed(1)} KB`);
  }
  process.exit(0);
};

run();
