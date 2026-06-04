import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/fosssil-procure';

    const conn = await mongoose.connect(mongoURI);

    console.log(`📦 MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(
      `❌ MongoDB connection error: ${(error as Error).message}`
    );
    // Don't exit in development - allows running without MongoDB
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

export default connectDB;
