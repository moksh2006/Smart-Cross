/**
 * Historical learning and prediction evaluation (MongoDB-backed).
 *
 *  - recordPassage(): stores an observed crossing passage (positional data only).
 *  - getTrainHistory(): per-crossing mean/std offset from scheduled corridor
 *    entry (LIVE passages only) + average speed -> fallback level 4.
 *  - logPrediction(): stores a prediction sample at fixed horizons.
 *  - evaluatePassage(): compares logged predictions with the observed passage.
 */
const HistoricalTrainObservation = require('../../models/HistoricalTrainObservation');
const Prediction = require('../../models/Prediction');
const PredictionEvaluation = require('../../models/PredictionEvaluation');
const { istDayName } = require('../../utils/time');
const log = require('../../utils/logger')('history');

const HORIZONS_MIN = [15, 10, 5, 2];
const HISTORY_WINDOW_DAYS = 60;
const CACHE_MS = 10 * 60000;

const cache = new Map();

async function getTrainHistory(trainNumber) {
  const key = String(trainNumber);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86400000);
  let value = { perCrossing: {}, avgSpeedKmh: null };
  try {
    const rows = await HistoricalTrainObservation.aggregate([
      { $match: { mode: 'LIVE', trainNumber: key, observedArrival: { $gte: since }, offsetFromScheduledEntrySeconds: { $ne: null } } },
      {
        $group: {
          _id: '$phatakNumber',
          mean: { $avg: '$offsetFromScheduledEntrySeconds' },
          std: { $stdDevPop: '$offsetFromScheduledEntrySeconds' },
          samples: { $sum: 1 },
          speed: { $avg: '$speedKmh' }
        }
      }
    ]);
    const perCrossing = {};
    let speedSum = 0; let speedN = 0;
    for (const r of rows) {
      perCrossing[r._id] = { meanOffsetSeconds: Math.round(r.mean), stdSeconds: Math.round(r.std || 0), samples: r.samples };
      if (Number.isFinite(r.speed)) { speedSum += r.speed; speedN += 1; }
    }
    value = { perCrossing, avgSpeedKmh: speedN ? Math.round(speedSum / speedN) : null };
  } catch (e) {
    log.warn(`History query failed for ${key}: ${e.message}`);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_MS });
  return value;
}

function invalidate(trainNumber) { cache.delete(String(trainNumber)); }

/**
 * @param {{ mode, serviceDate, trainNumber, phatakNumber, direction, observedArrival: Date,
 *   speedKmh, delayMinutes, scheduledEntryTime: Date|null, closureSeconds }} p
 */
async function recordPassage(p) {
  try {
    await HistoricalTrainObservation.updateOne(
      { mode: p.mode, serviceDate: p.serviceDate, trainNumber: p.trainNumber, phatakNumber: p.phatakNumber },
      {
        $setOnInsert: {
          mode: p.mode,
          serviceDate: p.serviceDate,
          dayOfWeek: istDayName(p.observedArrival),
          trainNumber: p.trainNumber,
          phatakNumber: p.phatakNumber,
          direction: p.direction,
          observedArrival: p.observedArrival,
          speedKmh: Number.isFinite(p.speedKmh) ? Math.round(p.speedKmh) : null,
          delayMinutes: Number.isFinite(p.delayMinutes) ? p.delayMinutes : null,
          scheduledEntryTime: p.scheduledEntryTime || null,
          offsetFromScheduledEntrySeconds: p.scheduledEntryTime
            ? Math.round((p.observedArrival - p.scheduledEntryTime) / 1000) : null,
          estimatedClosureSeconds: p.closureSeconds ?? null
        }
      },
      { upsert: true, runValidators: true }
    );
    invalidate(p.trainNumber);
    await evaluatePassage(p);
  } catch (e) {
    log.warn(`recordPassage failed: ${e.message}`);
  }
}

async function logPrediction(p) {
  try {
    await Prediction.updateOne(
      { mode: p.mode, serviceDate: p.serviceDate, trainNumber: p.trainNumber, phatakNumber: p.phatakNumber, horizonMinutes: p.horizonMinutes },
      { $setOnInsert: { ...p, recordedAt: new Date() } },
      { upsert: true, runValidators: true }
    );
  } catch (e) {
    log.debug(`logPrediction failed: ${e.message}`);
  }
}

async function evaluatePassage(p) {
  const logged = await Prediction.find({
    mode: p.mode, serviceDate: p.serviceDate, trainNumber: p.trainNumber, phatakNumber: p.phatakNumber
  }).lean();
  for (const l of logged) {
    const err = Math.round((new Date(l.predictedArrival) - p.observedArrival) / 1000);
    await PredictionEvaluation.updateOne(
      { mode: p.mode, serviceDate: p.serviceDate, trainNumber: p.trainNumber, phatakNumber: p.phatakNumber, horizonMinutes: l.horizonMinutes },
      {
        $setOnInsert: {
          mode: p.mode,
          serviceDate: p.serviceDate,
          trainNumber: p.trainNumber,
          phatakNumber: p.phatakNumber,
          horizonMinutes: l.horizonMinutes,
          source: l.source,
          predictedArrival: l.predictedArrival,
          observedArrival: p.observedArrival,
          errorSeconds: err,
          absoluteErrorSeconds: Math.abs(err)
        }
      },
      { upsert: true }
    ).catch(() => {});
  }
}

module.exports = { HORIZONS_MIN, getTrainHistory, invalidate, recordPassage, logPrediction, evaluatePassage };
