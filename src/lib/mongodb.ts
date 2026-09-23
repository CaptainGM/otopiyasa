import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI ortam değişkeni tanımlı değil.");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = (globalThis as any).mongooseCache ?? {
  conn: null,
  promise: null,
};

(globalThis as any).mongooseCache = cached;

export async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (cached.promise && (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2)) {
    try {
      cached.conn = await cached.promise;
      return cached.conn;
    } catch {
      cached.promise = null;
      cached.conn = null;
    }
  }

  cached.conn = null;
  cached.promise = mongoose.connect(MONGODB_URI!, {
    bufferCommands: true,
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 10_000,
    socketTimeoutMS: 20_000,
    connectTimeoutMS: 8_000,
    serverSelectionTimeoutMS: 8_000,
    retryWrites: true,
    retryReads: true,
  });

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
}
