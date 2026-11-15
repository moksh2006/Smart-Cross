/**
 * Five-level fallback prediction engine (pure; no I/O).
 *
 *  1. LIVE_POSITION         fresh position (age <= STALE_DATA_THRESHOLD_SECONDS) + speed
 *  2. LATEST_OBSERVATION    older position (<= MAX_DEAD_RECKONING_SECONDS) + dead reckoning
 *  3. TIMETABLE_WITH_DELAY  schedule + a recently observed delay
 *  4. HISTORICAL_AVERAGE    mean observed offset from scheduled corridor entry (>= MIN_HISTORICAL_SAMPLES)
 *  5. TIMETABLE_ESTIMATE    schedule only
 *  otherwise UNKNOWN.
 *
 * Simulation trains use exactly the same path; their observations simply carry
 * dataSource = 'SIMULATION'.
 */
const { PREDICTION_SOURCE, CONFIDENCE, CONFIDENCE_RANK } = require('../../config/constants');
const corridor = require('../../config/corridor');
const {
  effectiveSpeed,
  kmhToMps,
  positionalCrossingPrediction,
  timeBasedCrossingPrediction,
  STOPPED_SPEED_KMH
} = require('./etaCalculator');

const RESTART_ASSUME_SECONDS = 120;   // a stopped train is assumed to stay stopped this long when dead reckoning
const DEFAULT_STATION_DWELL_S = 120;
const SIGNAL_STOP_RESTART_S = 60;
const MAX_REASONABLE_ETA_S = 6 * 3600;

const minConfidence = (a, b) => (CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b);

/**
 * Remaining dwell for a train stopped at PTA/DBN, using the scheduled departure + delay.
 */
function stationDwellSeconds(train, now) {
  const obs = train.lastObservation;
  const timing = train.timing;
  if (!obs || !obs.atStation || !timing) return DEFAULT_STATION_DWELL_S;
  const dep = obs.currentStationCode === 'PTA' ? timing.ptaDeparture : obs.currentStationCode === 'DBN' ? timing.dbnDeparture : null;
  if (!dep) return DEFAULT_STATION_DWELL_S;
  const delay = Number.isFinite(obs.delayMinutes) ? obs.delayMinutes : 0;
  const s = (dep.getTime() + delay * 60000 - now.getTime()) / 1000;
  return Math.min(15 * 60, Math.max(30, Math.round(s)));
}

/** Estimate the current chainage from an observation (dead reckoning). */
function estimatePosition(train, now, t) {
  const obs = train.lastObservation;
  const ageSeconds = Math.max(0, (now - obs.observedAt) / 1000);
  const sign = corridor.DIRECTIONS[train.direction].sign;
  const speed = effectiveSpeed({
    measuredKmh: obs.speedKmh,
    recentKmh: train.recentSpeeds,
    historicalKmh: train.historicalSpeedKmh
  }, t);

  let travelled;
  if (speed.stopped || obs.atStation) {
    const hold = obs.atStation ? stationDwellSeconds(train, obs.observedAt) : RESTART_ASSUME_SECONDS;
    travelled = Math.max(0, ageSeconds - hold) * kmhToMps(speed.speedKmh);
  } else {
    travelled = ageSeconds * kmhToMps(speed.speedKmh);
  }
  // Never extrapolate more than 3 km past the corridor exit.
  const ends = corridor.corridorEnds(train.direction);
  let chainage = obs.chainage + sign * travelled;
  const limit = ends.exit + sign * 3000;
  if (sign > 0) chainage = Math.min(chainage, limit); else chainage = Math.max(chainage, limit);
  return { chainage, ageSeconds, speed, travelledMeters: travelled };
}

function positionalConfidence(level, { ageSeconds, speed, positionMethod, etaSeconds }) {
  let c;
  if (level === 1) {
    c = ageSeconds <= 60 && !speed.stopped && speed.basis.startsWith('MEASURED') && positionMethod !== 'STATION'
      ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM;
  } else {
    c = ageSeconds <= 300 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;
  }
  if (etaSeconds > 30 * 60) c = minConfidence(c, CONFIDENCE.MEDIUM);
  if (etaSeconds > 60 * 60) c = minConfidence(c, CONFIDENCE.LOW);
  return c;
}

/** Scheduled crossing time by linear interpolation of corridor entry/exit times. */
function scheduledCrossingTime(timing, crossing) {
  const ends = corridor.corridorEnds(timing.direction);
  const frac = Math.abs(crossing.chainage - ends.entry) / corridor.CORRIDOR_LENGTH_M;
  return new Date(timing.entryTime.getTime() + frac * (timing.exitTime - timing.entryTime));
}

/**
 * Predicts arrivals of one train at every configured crossing.
 *
 * @param {object} train TrainState: { trainNumber, trainName, mode, direction,
 *   lastObservation: { chainage, speedKmh, observedAt: Date, delayMinutes, atStation,
 *   currentStationCode, positionMethod, dataSource } | null,
 *   recentSpeeds: number[], historicalSpeedKmh: number|null,
 *   timing: corridorTiming|null, knownDelay: { minutes, observedAt: Date }|null,
 *   historical: { [crossingNumber]: { meanOffsetSeconds, samples, stdSeconds } } }
 * @param {Date} now
 * @param {object} t thresholds
 * @returns {{ source: string, level: number, confidence: string, positionChainage: number|null,
 *   dataAgeSeconds: number|null, effectiveSpeedKmh: number|null, predictions: object[], reason: string }}
 */
function predictTrain(train, now, t) {
  const calculatedAt = now;
  const base = { trainNumber: train.trainNumber, trainName: train.trainName, direction: train.direction, mode: train.mode, calculatedAt };
  const crossings = corridor.crossingOrder(train.direction);

  if (!corridor.DIRECTIONS[train.direction]) {
    return unknown(base, 'Direction of travel unknown');
  }

  const obs = train.lastObservation;
  const ageSeconds = obs ? (now - obs.observedAt) / 1000 : Infinity;

  // ---------- Levels 1 & 2: positional ----------
  if (obs && Number.isFinite(obs.chainage) && ageSeconds <= t.MAX_DEAD_RECKONING_SECONDS && ageSeconds >= -60) {
    const level = ageSeconds <= t.STALE_DATA_THRESHOLD_SECONDS ? 1 : 2;
    const source = level === 1 ? PREDICTION_SOURCE.LIVE_POSITION : PREDICTION_SOURCE.LATEST_OBSERVATION;
    const est = estimatePosition(train, now, t);
    const currentlyStopped = (Number.isFinite(obs.speedKmh) && obs.speedKmh <= STOPPED_SPEED_KMH && est.travelledMeters === 0) || false;
    let dwell = 0;
    if (currentlyStopped) {
      const elapsed = ageSeconds;
      dwell = obs.atStation
        ? Math.max(0, stationDwellSeconds(train, obs.observedAt) - elapsed)
        : Math.max(0, SIGNAL_STOP_RESTART_S);
    }
    const speed = { ...est.speed, stopped: currentlyStopped };

    const predictions = [];
    for (const c of crossings) {
      const d = corridor.distanceAhead(est.chainage, c.chainage, train.direction);
      const p = positionalCrossingPrediction({ distanceAheadMeters: d, speed, dwellSeconds: dwell, now }, t);
      if (!p || p.etaSeconds > MAX_REASONABLE_ETA_S) {
        predictions.push(unknownCrossing(base, c, 'ETA out of plausible range'));
        continue;
      }
      const confidence = positionalConfidence(level, {
        ageSeconds: est.ageSeconds, speed, positionMethod: obs.positionMethod, etaSeconds: p.etaSeconds
      });
      predictions.push({
        ...base, ...p,
        phatakNumber: c.number,
        source, level, confidence,
        effectiveSpeedKmh: Math.round(speed.speedKmh),
        speedBasis: speed.basis,
        dataAgeSeconds: Math.round(est.ageSeconds),
        dataSource: obs.dataSource,
        stoppedNow: currentlyStopped,
        positional: true
      });
    }
    return {
      ...base, source, level,
      confidence: predictions.find((p) => p.status === 'APPROACHING')?.confidence || (level === 1 ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM),
      positionChainage: Math.round(est.chainage),
      dataAgeSeconds: Math.round(est.ageSeconds),
      effectiveSpeedKmh: Math.round(speed.speedKmh),
      stopped: currentlyStopped,
      predictions,
      reason: level === 1
        ? `Live position (${obs.positionMethod || 'observed'}, ${Math.round(est.ageSeconds)} s old)`
        : `Dead reckoning from observation ${Math.round(est.ageSeconds)} s old`
    };
  }

  // ---------- Levels 3-5: time based ----------
  const timing = train.timing;
  if (!timing) return unknown(base, obs ? 'Position data too old and no timetable available' : 'No position data and no timetable available');

  const delayFresh = train.knownDelay && Number.isFinite(train.knownDelay.minutes) &&
    (now - train.knownDelay.observedAt) / 60000 <= t.RECENT_DELAY_VALIDITY_MINUTES;

  let level; let source; let arrivalFor; let confidence; let reason;
  if (delayFresh) {
    level = 3; source = PREDICTION_SOURCE.TIMETABLE_WITH_DELAY;
    const delayMs = train.knownDelay.minutes * 60000;
    arrivalFor = (c) => new Date(scheduledCrossingTime(timing, c).getTime() + delayMs);
    const delayAgeMin = (now - train.knownDelay.observedAt) / 60000;
    confidence = delayAgeMin <= 30 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;
    reason = `Timetable + known delay of ${train.knownDelay.minutes} min (observed ${Math.round(delayAgeMin)} min ago)`;
  } else {
    const hist = train.historical || {};
    const allHaveSamples = crossings.every((c) => hist[c.number] && hist[c.number].samples >= t.MIN_HISTORICAL_SAMPLES);
    if (allHaveSamples) {
      level = 4; source = PREDICTION_SOURCE.HISTORICAL_AVERAGE;
      arrivalFor = (c) => new Date(timing.entryTime.getTime() + hist[c.number].meanOffsetSeconds * 1000);
      const tight = crossings.every((c) => hist[c.number].samples >= 2 * t.MIN_HISTORICAL_SAMPLES && hist[c.number].stdSeconds <= 180);
      confidence = tight ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;
      reason = `Historical average of ${Math.min(...crossings.map((c) => hist[c.number].samples))}+ observed passages`;
    } else {
      level = 5; source = PREDICTION_SOURCE.TIMETABLE_ESTIMATE;
      arrivalFor = (c) => scheduledCrossingTime(timing, c);
      confidence = CONFIDENCE.LOW;
      reason = 'Scheduled timetable only (no live data or known delay)';
    }
  }

  const predictions = crossings.map((c) => {
    const p = timeBasedCrossingPrediction({ arrival: arrivalFor(c), now }, t);
    return {
      ...base, ...p,
      phatakNumber: c.number,
      source, level,
      confidence: p.etaSeconds > 60 * 60 ? CONFIDENCE.LOW : confidence,
      effectiveSpeedKmh: null,
      speedBasis: null,
      dataAgeSeconds: obs ? Math.round(ageSeconds) : null,
      dataSource: level === 4 ? 'HISTORICAL' : 'TIMETABLE',
      positional: false
    };
  });

  return {
    ...base, source, level, confidence,
    positionChainage: null,
    dataAgeSeconds: obs ? Math.round(ageSeconds) : null,
    effectiveSpeedKmh: null,
    stopped: false,
    predictions,
    reason
  };
}

function unknownCrossing(base, c, reason) {
  return {
    ...base, phatakNumber: c.number, status: 'UNKNOWN', source: PREDICTION_SOURCE.UNKNOWN, level: 6,
    confidence: CONFIDENCE.NONE, distanceMeters: null, etaSeconds: null, predictedArrival: null,
    predictedClosureStart: null, predictedReopen: null, closureDurationSeconds: null,
    effectiveSpeedKmh: null, dataAgeSeconds: null, positional: false, reason
  };
}

function unknown(base, reason) {
  return {
    ...base, source: PREDICTION_SOURCE.UNKNOWN, level: 6, confidence: CONFIDENCE.NONE,
    positionChainage: null, dataAgeSeconds: null, effectiveSpeedKmh: null, stopped: false,
    predictions: corridor.crossingOrder(base.direction).map((c) => unknownCrossing(base, c, reason)),
    reason
  };
}

module.exports = { predictTrain, scheduledCrossingTime, estimatePosition, stationDwellSeconds };
