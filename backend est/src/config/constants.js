/** Shared enumerations used across the backend (mirrored in frontend/src/lib/constants.js). */

const GATE_STATUS = Object.freeze({
  OPEN: 'OPEN',
  CLOSING_SOON: 'CLOSING_SOON',
  CLOSED: 'CLOSED',
  OPENING_SOON: 'OPENING_SOON',
  UNKNOWN: 'UNKNOWN'
});

/** Severity ordering used when several trains affect one crossing. */
const GATE_SEVERITY = Object.freeze({ OPEN: 0, OPENING_SOON: 1, CLOSING_SOON: 2, CLOSED: 3, UNKNOWN: -1 });

/** Five-level fallback hierarchy (level 1 = best). */
const PREDICTION_SOURCE = Object.freeze({
  LIVE_POSITION: 'LIVE_POSITION',
  LATEST_OBSERVATION: 'LATEST_OBSERVATION',
  TIMETABLE_WITH_DELAY: 'TIMETABLE_WITH_DELAY',
  HISTORICAL_AVERAGE: 'HISTORICAL_AVERAGE',
  TIMETABLE_ESTIMATE: 'TIMETABLE_ESTIMATE',
  UNKNOWN: 'UNKNOWN'
});

const SOURCE_LEVEL = Object.freeze({
  LIVE_POSITION: 1,
  LATEST_OBSERVATION: 2,
  TIMETABLE_WITH_DELAY: 3,
  HISTORICAL_AVERAGE: 4,
  TIMETABLE_ESTIMATE: 5,
  UNKNOWN: 6
});

/** Sources that carry an actual (or simulated) position along the track. */
const POSITIONAL_SOURCES = new Set([PREDICTION_SOURCE.LIVE_POSITION, PREDICTION_SOURCE.LATEST_OBSERVATION]);

const CONFIDENCE = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', NONE: 'NONE' });
const CONFIDENCE_RANK = Object.freeze({ NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 });

const DIRECTION = Object.freeze({
  PATIALA_TO_DHABLAN: 'PATIALA_TO_DHABLAN',
  DHABLAN_TO_PATIALA: 'DHABLAN_TO_PATIALA',
  UNKNOWN: 'UNKNOWN'
});

const MODE = Object.freeze({ LIVE: 'LIVE', SIMULATION: 'SIMULATION' });

const ALERT_TYPE = Object.freeze({
  GATE_STATUS_CHANGE: 'GATE_STATUS_CHANGE',
  GROUPED_CLOSURE: 'GROUPED_CLOSURE',
  SYSTEM_WARNING: 'SYSTEM_WARNING'
});

const ALERT_SEVERITY = Object.freeze({ INFO: 'INFO', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SUCCESS: 'SUCCESS' });

/** Socket.IO event names (mirrored in frontend). */
const SOCKET_EVENTS = Object.freeze({
  SNAPSHOT: 'corridor:snapshot',
  TRAIN_UPDATE: 'train:update',
  PHATAK_UPDATE: 'phatak:update',
  GATE_STATUS_CHANGE: 'gate:status-change',
  ALERT_NEW: 'alert:new',
  SYSTEM_STATUS: 'system:status'
});

module.exports = {
  GATE_STATUS,
  GATE_SEVERITY,
  PREDICTION_SOURCE,
  SOURCE_LEVEL,
  POSITIONAL_SOURCES,
  CONFIDENCE,
  CONFIDENCE_RANK,
  DIRECTION,
  MODE,
  ALERT_TYPE,
  ALERT_SEVERITY,
  SOCKET_EVENTS
};
