/**
 * Authoritative Railway Route ETA Calculator
 * Calculates accurate arrival, gate closure, gate opening, and road traffic waiting time
 * based on along-track railway route geometry, live speed, and corridor parameters.
 */

const { CONFIDENCE, PREDICTION_METHOD } = require('../../config/constants');

// Typical Northern Railway express/passenger corridor speed through Patiala urban section
const DEFAULT_CORRIDOR_SPEED_KMH = 45; // ~12.5 m/s
const MIN_EFFECTIVE_SPEED_KMH = 10;
const GATE_CLOSURE_LEAD_MINUTES = 3;   // Gate closes 3 minutes before train arrival
const TRAIN_PASSAGE_DURATION_MINUTES = 2; // Duration for full train length to clear phatak
const GATE_OPENING_BUFFER_MINUTES = 2; // Time taken to safely raise gates after train clears

/**
 * Computes ETA, closure, opening, and waiting time for a train approaching a phatak.
 * @param {number} distanceAlongRouteMeters Distance from train to phatak along railway line
 * @param {number} liveSpeedKmh Current train speed from RailRadar
 * @param {Date} referenceTime Base timestamp (defaults to now)
 * @param {string} predictionMethod Method used
 * @returns {object} Detailed prediction metrics
 */
function calculateRouteEta(
  distanceAlongRouteMeters,
  liveSpeedKmh = 0,
  referenceTime = new Date(),
  predictionMethod = PREDICTION_METHOD.LIVE_POSITION
) {
  // If train has already passed phatak (> 150m downstream)
  if (distanceAlongRouteMeters < -150) {
    const passedSecondsAgo = Math.abs(distanceAlongRouteMeters) / Math.max(10, (liveSpeedKmh * 1000 / 3600));
    return {
      distanceMeters: distanceAlongRouteMeters,
      etaSeconds: 0,
      etaMinutes: 0,
      predictedArrival: new Date(referenceTime.getTime() - passedSecondsAgo * 1000),
      predictedClosure: new Date(referenceTime.getTime() - (passedSecondsAgo + 180) * 1000),
      predictedOpening: new Date(referenceTime.getTime() + 60 * 1000), // Opening imminent
      waitingTimeMinutes: 0,
      hasPassed: true,
      confidence: CONFIDENCE.HIGH,
      method: predictionMethod
    };
  }

  // Determine effective travel speed along track
  // If train is stopped at station or speed reading is noisy/0, use calibrated corridor average
  let effectiveSpeedKmh = liveSpeedKmh;
  if (effectiveSpeedKmh < MIN_EFFECTIVE_SPEED_KMH) {
    effectiveSpeedKmh = DEFAULT_CORRIDOR_SPEED_KMH;
  }

  const speedMps = (effectiveSpeedKmh * 1000) / 3600; // meters per second
  const etaSeconds = Math.max(0, Math.round(distanceAlongRouteMeters / speedMps));
  const etaMinutes = Math.round((etaSeconds / 60) * 10) / 10;

  // Arrival timestamp
  const predictedArrival = new Date(referenceTime.getTime() + etaSeconds * 1000);

  // Closure timestamp: gate closes lead time before arrival (or right now if train is very close)
  const closureLeadSeconds = GATE_CLOSURE_LEAD_MINUTES * 60;
  const closureOffsetSeconds = Math.max(0, etaSeconds - closureLeadSeconds);
  const predictedClosure = new Date(referenceTime.getTime() + closureOffsetSeconds * 1000);

  // Opening timestamp: train arrival + passage time + opening buffer
  const openingOffsetSeconds = etaSeconds + (TRAIN_PASSAGE_DURATION_MINUTES + GATE_OPENING_BUFFER_MINUTES) * 60;
  const predictedOpening = new Date(referenceTime.getTime() + openingOffsetSeconds * 1000);

  // Road waiting time: duration gate will remain closed
  const totalGateClosedSeconds = (predictedOpening.getTime() - predictedClosure.getTime()) / 1000;
  const waitingTimeMinutes = Math.round((totalGateClosedSeconds / 60) * 10) / 10;

  let confidence = CONFIDENCE.HIGH;
  if (predictionMethod === PREDICTION_METHOD.TIMETABLE_WITH_DELAY || predictionMethod === PREDICTION_METHOD.HISTORICAL_AVERAGE) {
    confidence = CONFIDENCE.MEDIUM;
  } else if (predictionMethod === PREDICTION_METHOD.TIMETABLE_ESTIMATE || predictionMethod === PREDICTION_METHOD.UNKNOWN) {
    confidence = CONFIDENCE.LOW;
  }

  return {
    distanceMeters: Math.round(distanceAlongRouteMeters * 10) / 10,
    etaSeconds,
    etaMinutes,
    predictedArrival,
    predictedClosure,
    predictedOpening,
    waitingTimeMinutes,
    hasPassed: false,
    confidence,
    method: predictionMethod,
    effectiveSpeedKmh: Math.round(effectiveSpeedKmh)
  };
}

module.exports = {
  calculateRouteEta,
  DEFAULT_CORRIDOR_SPEED_KMH
};
