const env = require('../config/env');
const { dbStatus } = require('../config/db');
const { engine, scheduler, simulation, apiClient, socketManager } = require('../services/runtime');
const { adminEnabled } = require('../middleware/auth');

const startedAt = new Date();

exports.health = (req, res) => {
  const db = dbStatus();
  const healthy = db.state === 'connected';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'UP' : 'DEGRADED',
    service: 'smartcross-backend',
    version: '2.0.0',
    timestamp: new Date(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    db
  });
};

exports.status = (req, res) => {
  res.json({
    success: true,
    data: {
      ...engine.systemStatus(),
      environment: env.NODE_ENV,
      db: dbStatus(),
      adminLoginEnabled: adminEnabled(),
      railRadar: apiClient.status(),
      scheduler: { running: scheduler.status().running, lastTickAt: scheduler.status().lastTickAt },
      simulation: { running: simulation.running, trains: simulation.trains.size },
      sockets: { clients: socketManager.clientCount() },
      startedAt
    }
  });
};
