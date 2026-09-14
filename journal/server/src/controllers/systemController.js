const mongoose = require('mongoose');
const Train = require('../models/Train');
const TrainSchedule = require('../models/TrainSchedule');
const TrainRoute = require('../models/TrainRoute');
const PhatakPrediction = require('../models/PhatakPrediction');
const Alert = require('../models/Alert');
const AuditLog = require('../models/AuditLog');
const socketManager = require('../services/websocket/socketManager');
const { INITIAL_TRAIN_NUMBERS } = require('../config/constants');

exports.getSystemStatus = async (req, res, next) => {
  try {
    const isMongoConnected = mongoose.connection.readyState === 1;

    // RailRadar API stats
    const railRadarClient = require('../services/railradar/railRadarClient');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const lastSuccessLog = await AuditLog.findOne({ success: true }).sort({ requestTime: -1 });
    const lastErrorLog = await AuditLog.findOne({ success: false }).sort({ requestTime: -1 });
    const recentLogs = await AuditLog.find({ requestTime: { $gte: tenMinutesAgo } }).sort({ requestTime: -1 }).limit(10);
    const recentFailures = recentLogs.filter(l => !l.success).length;

    const isConfigured = Boolean(process.env.RAILRADAR_API_KEY && process.env.RAILRADAR_API_KEY.trim().length > 0);
    const isCooldown = railRadarClient.isCooldownActive ? railRadarClient.isCooldownActive() : false;

    let railradarStatus = 'connected';
    if (!isConfigured) {
      railradarStatus = 'disconnected';
    } else if (isCooldown) {
      railradarStatus = 'degraded';
    } else if (recentLogs.length > 0) {
      if (recentFailures > 7) railradarStatus = 'disconnected';
      else if (recentFailures > 2) railradarStatus = 'degraded';
      else railradarStatus = 'connected';
    } else {
      railradarStatus = 'connected';
    }

    const hasRecentError = lastErrorLog && (Date.now() - new Date(lastErrorLog.requestTime).getTime() < 10 * 60 * 1000);

    // Train counts
    const monitoredTrains = INITIAL_TRAIN_NUMBERS.length;
    const liveTrains = await Train.countDocuments({
      isMonitored: true,
      currentLocation: { $ne: null }
    });
    const activeCorridorTrains = await Train.countDocuments({
      status: { $in: ['ACTIVE', 'APPROACHING', 'IN_CORRIDOR'] }
    });

    const timetableRecords = await TrainSchedule.countDocuments();
    const routeRecords = await TrainRoute.countDocuments();
    const predictions = await PhatakPrediction.countDocuments({ isActive: true });
    const alerts = await Alert.countDocuments();

    const trainPollingScheduler = require('../services/scheduler/trainPollingScheduler');
    const schedulerTable = trainPollingScheduler.getSchedulerState();
    const activePollingTrains = schedulerTable.filter(t => t.pollingStatus === 'LIVE' || t.pollingStatus === 'LIVE_POLLING_STARTED').length;
    const scheduledTrains = schedulerTable.filter(t => t.pollingStatus === 'WAITING_FOR_SCHEDULED_TIME' || t.pollingStatus === 'SCHEDULED').length;

    res.json({
      success: true,
      mongodb: isMongoConnected ? 'connected' : 'disconnected',
      railradar: railradarStatus,
      railradarConfigured: Boolean(process.env.RAILRADAR_API_KEY && process.env.RAILRADAR_API_KEY.trim().length > 0),
      socket: socketManager.io ? 'running' : 'stopped',
      schedulerRunning: trainPollingScheduler.isRunning,
      schedulerMode: process.env.DEV_FORCE_LIVE_POLLING === 'true' ? 'DEV_FORCE_LIVE_POLLING' : 'TIMETABLE_DRIVEN',
      connectedSocketClients: socketManager.connectedClients || 0,
      monitoredTrains,
      liveTrains,
      activeTrains: activeCorridorTrains,
      activePollingTrains,
      scheduledTrains,
      timetableRecords,
      routeRecords,
      predictions,
      alerts,
      schedulerTable,
      lastRailRadarRequest: recentLogs.length > 0 ? recentLogs[0].requestTime : null,
      lastSuccessfulRailRadarRequest: lastSuccessLog ? lastSuccessLog.requestTime : null,
      lastError: hasRecentError ? `${lastErrorLog.errorCode || 'ERROR'}: ${lastErrorLog.endpoint}` : null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};
