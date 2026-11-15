/**
 * SmartCross backend entry point.
 * Starts HTTP + Socket.IO, connects MongoDB, seeds reference data, starts the
 * corridor engine and either live polling or simulation mode, and shuts down
 * gracefully on SIGINT/SIGTERM.
 */
const http = require('http');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { createApp } = require('./app');
const { seedReferenceData } = require('./seeds/seed');
const settings = require('./services/settings/settingsService');
const { engine, scheduler, simulation, socketManager, apiClient } = require('./services/runtime');
const log = require('./utils/logger')('server');

async function start() {
  await connectDB();
  await seedReferenceData();
  await settings.load();
  await apiClient.restoreUsage();

  const app = createApp();
  const server = http.createServer(app);
  socketManager.init(server, { origins: env.CLIENT_URLS, snapshotProvider: () => engine.snapshot() });

  const mode = env.resolveDataMode();
  if (mode === 'LIVE' && !env.RAILRADAR_API_KEY) {
    log.warn('DATA_MODE=LIVE but RAILRADAR_API_KEY is missing; starting in SIMULATION mode.');
  }
  await engine.setMode(mode === 'LIVE' && env.RAILRADAR_API_KEY ? 'LIVE' : 'SIMULATION', { reason: 'startup' });
  engine.start();
  scheduler.start();

  await new Promise((resolve) => server.listen(env.PORT, resolve));
  log.info(`SmartCross API listening on :${env.PORT} | mode ${engine.mode} | RailRadar key ${env.RAILRADAR_API_KEY ? 'configured' : 'NOT configured (simulation only)'}`);

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`${signal} received, shutting down...`);
    const force = setTimeout(() => process.exit(1), 10000);
    force.unref();
    scheduler.stop();
    simulation.stop();
    engine.stop();
    socketManager.close();
    server.close(async () => {
      await disconnectDB().catch(() => {});
      log.info('Shutdown complete');
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (e) => log.error(`Unhandled rejection: ${e && e.stack ? e.stack : e}`));
  return server;
}

if (require.main === module) {
  start().catch((e) => {
    log.error(`Startup failed: ${e.stack || e.message}`);
    process.exit(1);
  });
}

module.exports = { start };
