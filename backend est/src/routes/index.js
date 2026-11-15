const express = require('express');
const { ah } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

const state = require('../controllers/stateController');
const phatak = require('../controllers/phatakController');
const train = require('../controllers/trainController');
const prediction = require('../controllers/predictionController');
const alert = require('../controllers/alertController');
const analytics = require('../controllers/analyticsController');
const setting = require('../controllers/settingController');
const sim = require('../controllers/simulationController');
const system = require('../controllers/systemController');
const admin = require('../controllers/adminController');
const debug = require('../controllers/debugController');

const r = express.Router();

// ---- Public read endpoints
r.get('/health', system.health);
r.get('/state', state.getState);
r.get('/corridor', state.getCorridor);
r.get('/system/status', system.status);
r.get('/phataks', phatak.list);
r.get('/phataks/nearby', ah(phatak.nearby));
r.get('/phataks/:number', ah(phatak.detail));
r.get('/trains', ah(train.list));
r.get('/trains/:number', ah(train.detail));
r.get('/predictions', ah(prediction.list));
r.get('/alerts', ah(alert.list));
r.post('/alerts/subscribe', ah(alert.subscribe));
r.get('/analytics/summary', ah(analytics.summary));
r.get('/settings', setting.get);
r.get('/simulation/status', sim.status);

// ---- Authentication
r.post('/auth/login', loginLimiter, ah(admin.login));
r.get('/auth/me', requireAdmin, admin.me);

// ---- Admin-only operations
r.put('/settings', requireAdmin, ah(setting.update));
r.delete('/settings/:key', requireAdmin, ah(setting.reset));
r.put('/admin/mode', requireAdmin, ah(admin.setMode));
r.get('/admin/metrics', requireAdmin, ah(admin.metrics));
r.get('/admin/api-logs', requireAdmin, ah(admin.apiLogs));
r.get('/admin/scheduler', requireAdmin, admin.scheduler);
r.post('/predictions/recalculate', requireAdmin, ah(prediction.recalculate));
r.post('/trains/:number/refresh', requireAdmin, ah(train.refresh));
r.get('/debug/railradar/:number', requireAdmin, ah(debug.railRadar));

r.post('/simulation/start', requireAdmin, ah(sim.start));
r.post('/simulation/stop', requireAdmin, ah(sim.stop));
r.post('/simulation/pause', requireAdmin, sim.pause);
r.post('/simulation/resume', requireAdmin, sim.resume);
r.post('/simulation/reset', requireAdmin, ah(sim.reset));
r.post('/simulation/scenarios/:name', requireAdmin, ah(sim.scenario));
r.post('/simulation/trains', requireAdmin, ah(sim.addTrain));
r.patch('/simulation/trains/:id', requireAdmin, ah(sim.updateTrain));
r.delete('/simulation/trains/:id', requireAdmin, ah(sim.removeTrain));

module.exports = r;
