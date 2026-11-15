/**
 * MongoDB connection management.
 * - Uses MONGODB_URI when configured.
 * - Falls back to an in-memory MongoDB ONLY when ALLOW_IN_MEMORY_DB is true
 *   (default in development/test, always false in production) so data loss
 *   can never happen silently in a deployment.
 */
const mongoose = require('mongoose');
const env = require('./env');
const log = require('../utils/logger')('db');

mongoose.set('strictQuery', true);

let memoryServer = null;
let usingMemory = false;

async function connectDB(uriOverride) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  const uri = uriOverride || env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 20 });
      log.info(`Connected to MongoDB at ${mongoose.connection.host}`);
      usingMemory = false;
      return mongoose.connection;
    } catch (err) {
      if (!env.ALLOW_IN_MEMORY_DB) throw new Error(`MongoDB connection failed: ${err.message}`);
      log.warn(`MongoDB connection failed (${err.message}); falling back to in-memory database (development only).`);
    }
  } else if (!env.ALLOW_IN_MEMORY_DB) {
    throw new Error('MONGODB_URI is not configured and in-memory fallback is disabled.');
  }

  // eslint-disable-next-line global-require
  const { MongoMemoryServer } = require('mongodb-memory-server');
  if (!memoryServer) memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  usingMemory = true;
  log.warn('Using in-memory MongoDB: data will be lost when the process stops.');
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

function dbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return { state: states[mongoose.connection.readyState] || 'unknown', inMemory: usingMemory };
}

module.exports = { connectDB, disconnectDB, dbStatus };
