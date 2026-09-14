const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { connectDB } = require('./config/db');
const { DEFAULTS, INITIAL_TRAIN_NUMBERS } = require('./config/constants');
const socketManager = require('./services/websocket/socketManager');
const trainPollingScheduler = require('./services/scheduler/trainPollingScheduler');

const { apiLogger } = require('./middleware/apiLogger');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const phatakRoutes = require('./routes/phatakRoutes');
const trainRoutes = require('./routes/trainRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const alertRoutes = require('./routes/alertRoutes');
const adminRoutes = require('./routes/adminRoutes');
const simulationRoutes = require('./routes/simulationRoutes');
const settingRoutes = require('./routes/settingRoutes');
const debugRoutes = require('./routes/debugRoutes');
const systemRoutes = require('./routes/systemRoutes');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. Security & Core Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allows Leaflet tiles and Web Audio
}));

app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiLogger);
app.use('/api', apiLimiter);

// 2. Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'SmartCross Patiala Railway Prediction Engine',
    timestamp: new Date(),
    corridor: 'Patiala (PTA) - Dhablan (DBN)',
    phataks: [19, 20, 23, 24],
    version: '1.0.0'
  });
});

// 3. API Routes
app.use('/api/phataks', phatakRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/system', systemRoutes);

// 4. Error Handler Middleware
app.use(errorHandler);

// 5. Initialize Socket.IO
socketManager.init(server, CLIENT_URL);

// 6. Server Initialization function
async function startServer() {
  try {
    await connectDB();

    // Auto-seed if database is empty
    const Phatak = require('./models/Phatak');
    const phatakCount = await Phatak.countDocuments();
    if (phatakCount === 0) {
      console.log('[Server] Database is empty. Running auto-seeding for Patiala corridor...');
      const seed = require('../../scripts/seedDatabase');
      await seed();
    }

    // Initialize smart train polling scheduler
    const SystemSetting = require('./models/SystemSetting');
    const monitoredSetting = await SystemSetting.findOne({ key: 'MONITORED_TRAIN_NUMBERS' });
    const monitoredTrains = (monitoredSetting && Array.isArray(monitoredSetting.value))
      ? monitoredSetting.value
      : INITIAL_TRAIN_NUMBERS;

    await trainPollingScheduler.init(monitoredTrains);

    // Only start polling in live mode (not during unit test runner)
    if (process.env.NODE_ENV !== 'test') {
      trainPollingScheduler.start(DEFAULTS.ACTIVE_POLL_INTERVAL_SECONDS, (trainNo, liveData) => {
        socketManager.emitTrainUpdate(liveData);
      });
    }

    server.listen(PORT, () => {
      console.log(`========================================================`);
      console.log(`🚆 SMARTCROSS API SERVER RUNNING ON PORT ${PORT}`);
      console.log(`📍 Patiala Corridor: Phataks 19, 20, 23, 24`);
      console.log(`🌐 Client URL: ${CLIENT_URL}`);
      console.log(`🔑 RAILRADAR_API_KEY: ${process.env.RAILRADAR_API_KEY ? 'configured' : 'not configured'}`);
      console.log(`📦 MONGODB_URI: ${process.env.MONGODB_URI ? 'configured' : 'not configured'}`);
      console.log(`⚙️  DEV_FORCE_LIVE_POLLING: ${process.env.DEV_FORCE_LIVE_POLLING === 'true' ? 'enabled' : 'disabled'}`);
      console.log(`========================================================`);
    });

  } catch (err) {
    console.error('[Server] Critical startup error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server };
