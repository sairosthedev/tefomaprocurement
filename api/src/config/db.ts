import mongoose from 'mongoose';

/**
 * Cache the connection promise across invocations. On Vercel (serverless),
 * the module is reused between warm invocations, so we must not open a new
 * connection every request, and we must never call process.exit() in the
 * request path (that kills the function and produces a platform 500 with no
 * CORS headers).
 */
let cached: Promise<typeof mongoose> | null = null;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached) return cached;

  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  cached = mongoose
    .connect(mongoURI, {
      serverSelectionTimeoutMS: 10_000,
      bufferCommands: false
    })
    .then((m) => {
      console.log(`📦 MongoDB connected: ${m.connection.host}`);
      return m;
    })
    .catch((error) => {
      // Reset so the next invocation can retry instead of caching a failure.
      cached = null;
      console.error(
        `❌ MongoDB connection error: ${(error as Error).message}`
      );
      throw error;
    });

  return cached;
}

const connectDB = async (): Promise<void> => {
  await connectToDatabase();
};

export default connectDB;
