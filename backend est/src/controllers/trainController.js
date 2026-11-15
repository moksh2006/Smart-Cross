const { engine, scheduler } = require('../services/runtime');
const settings = require('../services/settings/settingsService');
const { getSchedule, nearestCorridorTiming } = require('../services/railradar/trainScheduleService');
const { TrainLiveSnapshot, Train } = require('../models');
const { trainNumber, BadRequest } = require('../middleware/validate');
const { MODE } = require('../config/constants');

exports.list = async (req, res) => {
  const tracked = [...engine.trains.values()].map((t) => engine.trainView(t));
  const monitored = [];
  if (engine.mode === MODE.LIVE) {
    const now = new Date();
    for (const n of settings.monitoredTrains()) {
      const s = await getSchedule(n);
      const timing = s ? nearestCorridorTiming(s, now) : null;
      monitored.push({
        trainNumber: n,
        trainName: s ? s.trainName : '',
        direction: timing ? timing.direction : (s && s.corridorDirection) || 'UNKNOWN',
        scheduledEntry: timing ? timing.entryTime : null,
        scheduledExit: timing ? timing.exitTime : null,
        scheduleSource: s ? s.source : null,
        scheduleVerified: s ? Boolean(s.verified) : false,
        tracked: engine.trains.has(n)
      });
    }
  }
  res.json({ success: true, data: { mode: engine.mode, tracked, monitored } });
};

exports.detail = async (req, res) => {
  const n = trainNumber(req.params.number);
  const t = engine.trains.get(n);
  const isSim = n.startsWith('SIM-');
  const schedule = isSim ? null : await getSchedule(n);
  if (!t && !schedule) throw Object.assign(new BadRequest(`Train ${n} is not known`), { status: 404 });
  const [snapshots, doc] = isSim ? [[], null] : await Promise.all([
    TrainLiveSnapshot.find({ trainNumber: n }).sort({ observedAt: -1 }).limit(20).lean(),
    Train.findOne({ trainNumber: n }).lean()
  ]);
  const r = engine.lastTrainResults.get(n);
  const plan = scheduler.status().plans.find((p) => p.trainNumber === n) || null;
  res.json({
    success: true,
    data: {
      train: t ? engine.trainView(t) : null,
      predictions: r ? r.predictions.map((p) => engine.predictionView(p)) : [],
      schedule: schedule ? {
        trainName: schedule.trainName, runningDays: schedule.runningDays, source: schedule.source,
        verified: Boolean(schedule.verified), direction: schedule.corridorDirection,
        stops: (schedule.stops || []).map((s) => ({ stationCode: s.stationCode, stationName: s.stationName, arrivalTime: s.arrivalTime, departureTime: s.departureTime, dayOffset: s.dayOffset, distanceKm: s.distanceKm }))
      } : null,
      lastKnown: doc ? {
        observedAt: doc.lastObservedAt, speedKmh: doc.speedKmh, delayMinutes: doc.delayMinutes,
        currentStation: doc.currentStation, lastPolledAt: doc.lastPolledAt, lastPollError: doc.lastPollError
      } : null,
      recentObservations: snapshots.map((s) => ({
        observedAt: s.observedAt, chainageMeters: s.chainageMeters, positionMethod: s.positionMethod,
        speedKmh: s.speedKmh, delayMinutes: s.delayMinutes, currentStation: s.currentStation
      })),
      pollingPlan: plan
    }
  });
};

exports.refresh = async (req, res) => {
  const n = trainNumber(req.params.number);
  if (engine.mode !== MODE.LIVE) throw new BadRequest('Manual refresh is only available in LIVE mode');
  const plan = await scheduler.refreshNow(n);
  res.json({ success: true, data: { trainNumber: n, result: plan.lastResult, ingest: plan.lastIngest || null } });
};
