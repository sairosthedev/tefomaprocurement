import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI;

const countDatabase = async () => {
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log(`DB: ${mongoose.connection.name}`);
  const collections = await mongoose.connection.db!.listCollections().toArray();
  for (const { name } of collections) {
    const count = await mongoose.connection.db!.collection(name).countDocuments();
    console.log(`  ${name}: ${count}`);
  }
  process.exit(0);
};

countDatabase();
