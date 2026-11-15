/** Connects to TEST_MONGODB_URI if provided, otherwise an in-memory MongoDB. */
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');

async function connectTestDb(name) {
  if (process.env.TEST_MONGODB_URI) {
    await connectDB(process.env.TEST_MONGODB_URI.replace(/\/([^/?]*)(\?|$)/, `/smartcross_test_${name}$2`));
  } else {
    await connectDB();
  }
  await mongoose.connection.db.dropDatabase();
}

module.exports = { connectTestDb, disconnectTestDb: disconnectDB };
