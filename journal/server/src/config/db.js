const mongoose = require('mongoose');
const dns = require('dns');

// On Windows, Node.js c-ares DNS resolver can fail on SRV queries with local ISP DNS.
// Setting public DNS fallback ensures Atlas SRV resolution succeeds seamlessly.
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore in environments where setting DNS servers is restricted
}

let mongodInstance = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri && mongoUri.trim().length > 0) {
    try {
      console.log(`Connecting to MongoDB Atlas / configured URI: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}`);
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      console.warn(`Could not connect to configured MONGODB_URI: ${err.message}`);
      console.log('Falling back to MongoMemoryServer for autonomous dev/test environment...');
    }
  }

  // Fallback to mongodb-memory-server
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongodInstance = await MongoMemoryServer.create();
    const uri = mongodInstance.getUri();
    console.log(`Starting in-memory MongoDB at: ${uri}`);
    const conn = await mongoose.connect(uri);
    console.log('In-memory MongoDB Connected successfully.');
    return conn;
  } catch (memErr) {
    console.error(`In-memory Mongo fallback error: ${memErr.message}`);
    throw memErr;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongodInstance) {
      await mongodInstance.stop();
      mongodInstance = null;
    }
  } catch (err) {
    console.error('Error disconnecting database:', err.message);
  }
};

module.exports = { connectDB, disconnectDB };
