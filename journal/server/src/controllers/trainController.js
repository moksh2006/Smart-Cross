const Train = require('../models/Train');
const TrainRoute = require('../models/TrainRoute');
const TrainSchedule = require('../models/TrainSchedule');
const liveTrainService = require('../services/railradar/liveTrainService');
const trainRouteService = require('../services/railradar/trainRouteService');
const trainPollingScheduler = require('../services/scheduler/trainPollingScheduler');
const scheduleTrackingEngine = require('../services/prediction/scheduleTrackingEngine');

exports.getAllTrains = async (req, res, next) => {
  try {
    const trains = await Train.find({ isMonitored: true }).sort({ trainNumber: 1 });
    const schedules = await TrainSchedule.find();
    const scheduleMap = new Map(schedules.map(s => [s.trainNumber, s]));

    const enriched = await Promise.all(trains.map(async (t) => {
      const sched = scheduleMap.get(t.trainNumber);
      const schedState = await scheduleTrackingEngine.evaluateScheduledTrainState(
        sched || t.trainNumber,
        new Date()
      );

      const isLiveApiReporting = t.dataSource === 'LIVE_API' && (t.speed > 0 || t.status === 'ACTIVE');
      const currentStatus = isLiveApiReporting ? t.status : (schedState ? schedState.status : t.status);
      const inCorridor = Boolean(schedState?.inCorridor || t.inCorridor);
      const isApproaching = Boolean(schedState?.isApproaching || t.isApproaching);
      const speed = isLiveApiReporting ? t.speed : (schedState ? schedState.speed : 0);
      const currentLocation = (isLiveApiReporting && t.currentLocation)
        ? t.currentLocation
        : (schedState?.currentLocation || t.currentLocation);

      return {
        ...t.toObject(),
        status: currentStatus,
        speed,
        inCorridor,
        isApproaching,
        scheduledProgress: schedState?.progress || t.scheduledProgress || 0,
        minutesUntilEntry: schedState?.minutesUntilEntry || null,
        elapsedMinutes: schedState?.elapsedMinutes || null,
        currentLocation,
        entryScheduledTime: sched ? sched.entryScheduledTime : (schedState?.entryScheduledTime || '--'),
        exitScheduledTime: sched ? sched.exitScheduledTime : (schedState?.exitScheduledTime || '--'),
        entryStationCode: sched ? sched.entryStationCode : (schedState?.entryStation || '--'),
        exitStationCode: sched ? sched.exitStationCode : (schedState?.exitStation || '--'),
        corridorDirection: sched ? sched.corridorDirection : t.direction
      };
    }));

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    next(err);
  }
};

exports.getTrainByNumber = async (req, res, next) => {
  try {
    const { number } = req.params;
    const train = await Train.findOne({ trainNumber: number });
    if (!train) {
      return res.status(404).json({ success: false, message: `Train ${number} not found` });
    }

    // Fetch or fallback route geometry
    const routeRes = await trainRouteService.getRouteGeometry(number);
    const schedule = await TrainSchedule.findOne({ trainNumber: number });
    const schedState = await scheduleTrackingEngine.evaluateScheduledTrainState(
      schedule || number,
      new Date()
    );

    const isLiveApiReporting = train.dataSource === 'LIVE_API' && (train.speed > 0 || train.status === 'ACTIVE');
    const currentStatus = isLiveApiReporting ? train.status : (schedState ? schedState.status : train.status);
    const inCorridor = Boolean(schedState?.inCorridor || train.inCorridor);
    const isApproaching = Boolean(schedState?.isApproaching || train.isApproaching);
    const speed = isLiveApiReporting ? train.speed : (schedState ? schedState.speed : 0);
    const currentLocation = (isLiveApiReporting && train.currentLocation)
      ? train.currentLocation
      : (schedState?.currentLocation || train.currentLocation);

    res.json({
      success: true,
      data: {
        ...train.toObject(),
        status: currentStatus,
        speed,
        inCorridor,
        isApproaching,
        scheduledProgress: schedState?.progress || train.scheduledProgress || 0,
        minutesUntilEntry: schedState?.minutesUntilEntry || null,
        elapsedMinutes: schedState?.elapsedMinutes || null,
        currentLocation,
        route: routeRes.data ? routeRes.data.geometry : null,
        schedule: schedule ? schedule.stations : [],
        entryScheduledTime: schedule ? schedule.entryScheduledTime : (schedState?.entryScheduledTime || '--'),
        exitScheduledTime: schedule ? schedule.exitScheduledTime : (schedState?.exitScheduledTime || '--'),
        corridorDirection: schedule ? schedule.corridorDirection : train.direction
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.refreshTrainLive = async (req, res, next) => {
  try {
    const { number } = req.params;
    const result = await liveTrainService.fetchLiveTrain(number);
    const updated = await Train.findOne({ trainNumber: number });

    res.json({
      success: true,
      data: updated,
      apiResult: result
    });
  } catch (err) {
    next(err);
  }
};

exports.simulateTrainSchedule = async (req, res, next) => {
  try {
    const { number } = req.params;
    const speedMultiplier = parseFloat(req.body.speed || req.query.speed || 2);

    trainPollingScheduler.simulateScheduledPassage(number, speedMultiplier).catch(err => {
      console.warn(`[TrainController] Simulation error for ${number}:`, err.message);
    });

    res.json({
      success: true,
      message: `Started scheduled passage simulation for Train ${number}`,
      trainNumber: number,
      speedMultiplier
    });
  } catch (err) {
    next(err);
  }
};

