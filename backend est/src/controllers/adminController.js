const { engine, scheduler, apiClient, socketManager } = require('../services/runtime');
const env = require('../config/env');
const { AuditLog, GateEvent, Alert, HistoricalTrainObservation, PredictionEvaluation } = require('../models');
const { login } = require('../middleware/auth');
const { intParam, oneOf, BadRequest } = require('../middleware/validate');
const { MODE } = require('../config/constants');

exports.login = (req, res) => {
  const { password } = req.body || {};
  res.json({ success: true, data: login(password) });
};

exports.me = (req, res) => res.json({ success: true, data: { role: req.admin.role } });

exports.setMode = async (req, res) => {
  const mode = oneOf((req.body || {}).mode, [MODE.LIVE, MODE.SIMULATION], { name: 'mode' });
  if (mode === MODE.LIVE && !env.RAILRADAR_API_KEY) throw new BadRequest('LIVE mode requires RAILRADAR_API_KEY on the server');
  await engine.setMode(mode, { actor: 'admin', reason: 'Admin request' });
  res.json({ success: true, data: engine.systemStatus() });
};

exports.metrics = async (req, res) => {
  const since = new Date(Date.now() - 86400000);
  const [apiCalls, apiFailures, gateEvents, alerts, passages, evaluations] = await Promise.all([
    AuditLog.countDocuments({ category: 'EXTERNAL_API', createdAt: { $gte: since } }),
    AuditLog.countDocuments({ category: 'EXTERNAL_API', createdAt: { $gte: since }, success: false }),
    GateEvent.countDocuments({ mode: engine.mode, timestamp: { $gte: since } }),
    Alert.countDocuments({ mode: engine.mode, createdAt: { $gte: since } }),
    HistoricalTrainObservation.countDocuments({ mode: engine.mode, createdAt: { $gte: since } }),
    PredictionEvaluation.countDocuments({ mode: engine.mode, evaluatedAt: { $gte: since } })
  ]);
  res.json({
    success: true,
    data: {
      mode: engine.mode,
      last24h: { apiCalls, apiFailures, gateEvents, alerts, passages, evaluations },
      railRadar: apiClient.status(),
      sockets: { clients: socketManager.clientCount(), ...socketManager.stats },
      engine: { trackedTrains: engine.trains.size, lastEvaluatedAt: engine.lastEvaluatedAt, seq: engine.seq },
      memory: process.memoryUsage().rss
    }
  });
};

exports.apiLogs = async (req, res) => {
  const limit = intParam(req.query.limit, { name: 'limit', min: 1, max: 500, def: 100 });
  const category = oneOf(req.query.category, ['EXTERNAL_API', 'ADMIN_ACTION', 'SYSTEM'], { name: 'category', def: 'EXTERNAL_API' });
  const logs = await AuditLog.find({ category }).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ success: true, data: logs });
};

exports.scheduler = (req, res) => res.json({ success: true, data: scheduler.status() });
