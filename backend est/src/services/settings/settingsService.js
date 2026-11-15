/**
 * Runtime settings: prediction thresholds and monitored trains.
 * Defaults come from env (config/env.js); overrides live in the SystemSetting
 * collection and are validated against fixed bounds.
 */
const env = require('../../config/env');
const SystemSetting = require('../../models/SystemSetting');
const AuditLog = require('../../models/AuditLog');
const bundled = require('../../data/bundledTimetable.json');

const BOUNDS = {
  CLOSING_SOON_THRESHOLD_MINUTES: [1, 60, 'Predict CLOSING_SOON when ETA is at or below this many minutes'],
  CLOSED_DISTANCE_METERS: [100, 5000, 'Predict CLOSED when a moving train is within this along-track distance'],
  CLOSED_ETA_MINUTES: [0.5, 10, 'Predict CLOSED when ETA is at or below this many minutes'],
  CLEARANCE_DISTANCE_METERS: [0, 2000, 'Distance the train tail must be past the crossing before reopening'],
  CLEARANCE_BUFFER_SECONDS: [0, 600, 'Extra time after clearance before OPEN is predicted'],
  TRAIN_LENGTH_METERS: [50, 1500, 'Assumed train length'],
  BACK_TO_BACK_GAP_SECONDS: [0, 900, 'Keep CLOSED if the next train closes within this gap after reopening'],
  STALE_DATA_THRESHOLD_SECONDS: [30, 3600, 'Position older than this is treated as stale (dead reckoning)'],
  MAX_DEAD_RECKONING_SECONDS: [60, 7200, 'Maximum age of a position used for dead reckoning'],
  RECENT_DELAY_VALIDITY_MINUTES: [5, 1440, 'How long an observed delay is used for timetable predictions'],
  PREDICTION_LOOKAHEAD_MINUTES: [10, 720, 'Trains expected within this window are tracked'],
  SCHEDULE_UNCERTAINTY_MINUTES: [0, 60, 'Window after a scheduled passage during which it is still "due"'],
  MIN_HISTORICAL_SAMPLES: [2, 100, 'Minimum observed passages required for historical averages'],
  DEFAULT_CORRIDOR_SPEED_KMH: [10, 130, 'Speed assumed when no speed data is available'],
  MIN_EFFECTIVE_SPEED_KMH: [1, 60, 'Lower bound for effective speed (avoids division by zero)'],
  MAX_TRAIN_SPEED_KMH: [30, 200, 'Upper bound for effective speed (outlier rejection)'],
  DOWNGRADE_CONFIRM_SECONDS: [0, 300, 'A less severe state must persist this long before it is shown'],
  ALERT_COOLDOWN_SECONDS: [0, 86400, 'Identical alerts are suppressed for this long']
};

let cache = null;
let monitoredCache = null;
const listeners = new Set();

async function load() {
  const t = { ...env.THRESHOLD_DEFAULTS };
  let monitored = bundled.trains.map((x) => x.trainNumber);
  try {
    const docs = await SystemSetting.find({}).lean();
    for (const d of docs) {
      if (BOUNDS[d.key] && Number.isFinite(Number(d.value))) t[d.key] = Number(d.value);
      if (d.key === 'MONITORED_TRAIN_NUMBERS' && Array.isArray(d.value)) monitored = d.value.map(String);
    }
  } catch (e) { /* DB unavailable: defaults */ }
  cache = t;
  monitoredCache = monitored;
  return t;
}

function thresholds() { return cache || { ...env.THRESHOLD_DEFAULTS }; }
function monitoredTrains() { return monitoredCache || bundled.trains.map((x) => x.trainNumber); }
function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function describe() {
  const t = thresholds();
  return {
    thresholds: Object.entries(BOUNDS).map(([key, [min, max, description]]) => ({
      key, value: t[key], default: env.THRESHOLD_DEFAULTS[key], min, max, description
    })),
    monitoredTrains: monitoredTrains(),
    note: 'These are software prediction thresholds, not verified physical gate timings.'
  };
}

class ValidationError extends Error {
  constructor(msg) { super(msg); this.status = 400; this.expose = true; }
}

async function update(key, value, actor = 'admin') {
  if (key === 'MONITORED_TRAIN_NUMBERS') {
    if (!Array.isArray(value) || value.length > 100 || !value.every((v) => /^[0-9A-Za-z\-_/ ]{1,20}$/.test(String(v)))) {
      throw new ValidationError('MONITORED_TRAIN_NUMBERS must be an array of up to 100 train numbers');
    }
    value = [...new Set(value.map(String))];
  } else if (BOUNDS[key]) {
    const [min, max] = BOUNDS[key];
    const v = Number(value);
    if (!Number.isFinite(v) || v < min || v > max) throw new ValidationError(`${key} must be a number between ${min} and ${max}`);
    value = v;
  } else {
    throw new ValidationError(`Unknown setting: ${key}`);
  }
  await SystemSetting.findOneAndUpdate(
    { key },
    { key, value, description: BOUNDS[key] ? BOUNDS[key][2] : 'Monitored train numbers', updatedBy: actor },
    { upsert: true, new: true, runValidators: true }
  );
  await AuditLog.create({ category: 'ADMIN_ACTION', action: 'UPDATE_SETTING', actor, details: { key, value } }).catch(() => {});
  await load();
  for (const fn of listeners) fn(key, value);
  return describe();
}

async function reset(key, actor = 'admin') {
  if (!BOUNDS[key] && key !== 'MONITORED_TRAIN_NUMBERS') throw new ValidationError(`Unknown setting: ${key}`);
  await SystemSetting.deleteOne({ key });
  await AuditLog.create({ category: 'ADMIN_ACTION', action: 'RESET_SETTING', actor, details: { key } }).catch(() => {});
  await load();
  for (const fn of listeners) fn(key, null);
  return describe();
}

module.exports = { load, thresholds, monitoredTrains, describe, update, reset, onChange, BOUNDS, ValidationError };
