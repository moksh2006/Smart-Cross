/**
 * ETA and closure-window calculations (pure functions).
 *
 * ETA = along-track distance / effective speed (+ dwell/restart time when stopped).
 * Closure window (software estimate, NOT a verified gate timing):
 *   closure starts when the train is within CLOSED_DISTANCE_METERS or CLOSED_ETA_MINUTES;
 *   reopening when the tail has cleared CLEARANCE_DISTANCE_METERS plus CLEARANCE_BUFFER_SECONDS.
 */

const STOPPED_SPEED_KMH = 3;
const kmhToMps = (v) => (v * 1000) / 3600;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Chooses an effective speed from the measured speed, recent observed speeds and
 * the historical average, bounded to [MIN_EFFECTIVE_SPEED_KMH, MAX_TRAIN_SPEED_KMH].
 * @returns {{ speedKmh: number, basis: string, stopped: boolean }}
 */
function effectiveSpeed({ measuredKmh = null, recentKmh = [], historicalKmh = null }, t) {
  const min = t.MIN_EFFECTIVE_SPEED_KMH;
  const max = t.MAX_TRAIN_SPEED_KMH;
  const moving = (recentKmh || []).filter((v) => Number.isFinite(v) && v > STOPPED_SPEED_KMH);
  const recentAvg = moving.length ? moving.reduce((a, b) => a + b, 0) / moving.length : null;
  const fallback = Number.isFinite(historicalKmh) && historicalKmh > STOPPED_SPEED_KMH
    ? historicalKmh : t.DEFAULT_CORRIDOR_SPEED_KMH;

  if (Number.isFinite(measuredKmh) && measuredKmh > STOPPED_SPEED_KMH) {
    // Blend the instantaneous reading with the recent average to damp jitter.
    const v = recentAvg ? 0.7 * measuredKmh + 0.3 * recentAvg : measuredKmh;
    return { speedKmh: clamp(v, min, max), basis: recentAvg ? 'MEASURED_BLENDED' : 'MEASURED', stopped: false };
  }
  if (Number.isFinite(measuredKmh) && measuredKmh <= STOPPED_SPEED_KMH) {
    return { speedKmh: clamp(recentAvg || fallback, min, max), basis: 'STOPPED_ASSUMED_RESTART', stopped: true };
  }
  if (recentAvg) return { speedKmh: clamp(recentAvg, min, max), basis: 'RECENT_AVERAGE', stopped: false };
  return {
    speedKmh: clamp(fallback, min, max),
    basis: Number.isFinite(historicalKmh) ? 'HISTORICAL_AVERAGE' : 'DEFAULT_CORRIDOR_SPEED',
    stopped: false
  };
}

/**
 * Closure window around an arrival time for a train moving at speedKmh.
 * @returns {{ closureStart: Date, reopen: Date, durationSeconds: number }}
 */
function closureWindow(arrival, speedKmh, t, { stopped = false } = {}) {
  const v = kmhToMps(Math.max(speedKmh, t.MIN_EFFECTIVE_SPEED_KMH));
  const leadByDistance = stopped ? 0 : t.CLOSED_DISTANCE_METERS / v;
  const lead = Math.max(leadByDistance, t.CLOSED_ETA_MINUTES * 60);
  const clear = (t.TRAIN_LENGTH_METERS + t.CLEARANCE_DISTANCE_METERS) / v + t.CLEARANCE_BUFFER_SECONDS;
  const closureStart = new Date(arrival.getTime() - lead * 1000);
  const reopen = new Date(arrival.getTime() + clear * 1000);
  return { closureStart, reopen, durationSeconds: Math.round((reopen - closureStart) / 1000) };
}

/**
 * Prediction for one crossing given a current position estimate.
 * @param {object} p
 * @param {number} p.distanceAheadMeters signed distance from train head to crossing (+ ahead)
 * @param {{speedKmh:number, stopped:boolean}} p.speed effective speed
 * @param {number} p.dwellSeconds expected remaining stop time before moving (0 if moving)
 * @param {Date} p.now
 * @param {object} t thresholds
 */
function positionalCrossingPrediction({ distanceAheadMeters: d, speed, dwellSeconds = 0, now }, t) {
  const v = kmhToMps(speed.speedKmh);
  if (!(v > 0)) return null;

  if (d > 0) {
    const etaSeconds = Math.round(dwellSeconds + d / v);
    const arrival = new Date(now.getTime() + etaSeconds * 1000);
    const w = closureWindow(arrival, speed.speedKmh, t, { stopped: speed.stopped });
    return {
      status: 'APPROACHING', distanceMeters: Math.round(d), etaSeconds,
      predictedArrival: arrival, predictedClosureStart: w.closureStart, predictedReopen: w.reopen,
      closureDurationSeconds: w.durationSeconds
    };
  }

  // Head has reached/passed the crossing. Time since head passed (approximate).
  const passedSeconds = Math.round(-d / v);
  const arrival = new Date(now.getTime() - passedSeconds * 1000);
  const w = closureWindow(arrival, speed.speedKmh, t);
  const tailPassed = -d >= t.TRAIN_LENGTH_METERS;
  const cleared = -d >= t.TRAIN_LENGTH_METERS + t.CLEARANCE_DISTANCE_METERS && now >= w.reopen;
  return {
    status: tailPassed ? 'PASSED' : 'AT_CROSSING',
    cleared,
    distanceMeters: Math.round(d),
    etaSeconds: 0,
    predictedArrival: arrival,
    predictedClosureStart: w.closureStart,
    predictedReopen: cleared ? w.reopen : new Date(Math.max(w.reopen.getTime(), now.getTime() + 1000)),
    closureDurationSeconds: w.durationSeconds
  };
}

/**
 * Prediction for one crossing from an expected arrival time (timetable / historical).
 */
function timeBasedCrossingPrediction({ arrival, now }, t) {
  const etaSeconds = Math.round((arrival - now) / 1000);
  const w = closureWindow(arrival, t.DEFAULT_CORRIDOR_SPEED_KMH, t);
  const uncertainty = t.SCHEDULE_UNCERTAINTY_MINUTES * 60;
  let status = 'APPROACHING';
  if (etaSeconds <= 0) status = -etaSeconds > uncertainty ? 'PASSED' : 'DUE';
  return {
    status,
    cleared: status === 'PASSED' && now >= w.reopen,
    distanceMeters: null,
    etaSeconds: Math.max(0, etaSeconds),
    predictedArrival: arrival,
    predictedClosureStart: w.closureStart,
    predictedReopen: w.reopen,
    closureDurationSeconds: w.durationSeconds
  };
}

module.exports = {
  STOPPED_SPEED_KMH,
  kmhToMps,
  effectiveSpeed,
  closureWindow,
  positionalCrossingPrediction,
  timeBasedCrossingPrediction
};
