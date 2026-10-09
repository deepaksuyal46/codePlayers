import mongoose from 'mongoose';

type Cache = {
  promise: Promise<typeof mongoose> | null;
};

const globalDB = globalThis as typeof globalThis & {
  codePlayersDB?: Cache;
};

const cache = globalDB.codePlayersDB ??= { promise: null };

export async function db() {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error('MONGODB_URI is missing from frontend/.env.local');
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME?.trim() || undefined,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 10000,
    });
  }

  try {
    return await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}