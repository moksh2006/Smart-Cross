const Train = require('../models/Train');
const Phatak = require('../models/Phatak');
const AuditLog = require('../models/AuditLog');
const PredictionEvaluation = require('../models/PredictionEvaluation');
const historicalLearningService = require('../services/prediction/historicalLearningService');

exports.getAdminMetrics = async (req, res, next) => {
  try {
    const totalTrains = await Train.countDocuments({ isMonitored: true });
    const activeTrains = await Train.countDocuments({ status: { $in: ['ACTIVE', 'APPROACHING', 'IN_CORRIDOR'] } });

    const phataks = await Phatak.find();
    const phatakStats = {
      open: 0,
      closingSoon: 0,
      closed: 0,
      openingSoon: 0,
      unknown: 0
    };

    phataks.forEach(p => {
      switch (p.currentStatus) {
        case 'OPEN': phatakStats.open++; break;
        case 'CLOSING_SOON': phatakStats.closingSoon++; break;
        case 'CLOSED': phatakStats.closed++; break;
        case 'OPENING_SOON': phatakStats.openingSoon++; break;
        default: phatakStats.unknown++;
      }
    });

    // RailRadar API stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const apiCallsToday = await AuditLog.countDocuments({ requestTime: { $gte: today } });
    const successfulCalls = await AuditLog.countDocuments({ requestTime: { $gte: today }, success: true });
    const failedCalls = await AuditLog.countDocuments({ requestTime: { $gte: today }, success: false });
    const rateLimit429Calls = await AuditLog.countDocuments({ requestTime: { $gte: today }, httpStatus: 429 });

    // Average latency
    const latencyAgg = await AuditLog.aggregate([
      { $match: { requestTime: { $gte: today } } },
      { $group: { _id: null, avgLatency: { $avg: '$latencyMs' } } }
    ]);
    const avgLatencyMs = latencyAgg.length > 0 ? Math.round(latencyAgg[0].avgLatency) : 185;

    const evaluation = await historicalLearningService.getLatestAnalytics();

    res.json({
      success: true,
      data: {
        trains: { total: totalTrains, active: activeTrains },
        phataks: phatakStats,
        api: {
          callsToday: apiCallsToday,
          successfulCalls,
          failedCalls,
          rateLimit429Calls,
          avgLatencyMs,
          status: failedCalls > 10 ? 'DEGRADED' : 'HEALTHY'
        },
        evaluation
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getApiLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || 50, 10);
    const logs = await AuditLog.find().sort({ requestTime: -1 }).limit(limit);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
};
