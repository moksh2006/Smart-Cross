/**
 * Centralised, validated environment configuration.
 * Every tunable value lives here so nothing else reads process.env directly.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const num = (name, def, { min = -Infinity, max = Infinity } = {}) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < min || v > max) {
    throw new Error(`Invalid value for ${name}: "${raw}" (expected number in [${min}, ${max}])`);
  }
  return v;
};
const bool = (name, def) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
};
const str = (name, def = '') => {
  const raw = process.env[name];
  return raw === undefined ? def : String(raw).trim();
};

const NODE_ENV = str('NODE_ENV', 'development');
const isTest = NODE_ENV === 'test';
const isProduction = NODE_ENV === 'production';

const isPlaceholder = (v) => !v || /<[^>]+>/.test(v) || /YOUR_|CHANGE_ME/i.test(v);

const railRadarKey = str('RAILRADAR_API_KEY');
const mongoUri = str('MONGODB_URI');

const config = {
  NODE_ENV,
  isTest,
  isProduction,
  PORT: num('PORT', 5000, { min: 1, max: 65535 }),
  CLIENT_URLS: str('CLIENT_URL', 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  TRUST_PROXY: bool('TRUST_PROXY', false),
  LOG_LEVEL: str('LOG_LEVEL', isTest ? 'silent' : 'info'),

  // Database
  MONGODB_URI: isPlaceholder(mongoUri) ? '' : mongoUri,
  // In-memory MongoDB is only for local development/tests; never in production.
  ALLOW_IN_MEMORY_DB: bool('ALLOW_IN_MEMORY_DB', !isProduction),

  // Security
  ADMIN_PASSWORD: str('ADMIN_PASSWORD'),
  JWT_SECRET: str('JWT_SECRET'),
  JWT_EXPIRES_IN: str('JWT_EXPIRES_IN', '12h'),
  API_RATE_LIMIT_PER_MINUTE: num('API_RATE_LIMIT_PER_MINUTE', 300, { min: 1 }),

  // Data mode: AUTO picks LIVE when an API key is configured, otherwise SIMULATION.
  DATA_MODE: str('DATA_MODE', 'AUTO').toUpperCase(),

  // RailRadar integration (https://railradar.in/docs)
  RAILRADAR_API_KEY: isPlaceholder(railRadarKey) ? '' : railRadarKey,
  RAILRADAR_BASE_URL: str('RAILRADAR_BASE_URL', 'https://api.railradar.in'),
  RAILRADAR_TIMEOUT_MS: num('RAILRADAR_TIMEOUT_MS', 10000, { min: 1000 }),
  RAILRADAR_MAX_RETRIES: num('RAILRADAR_MAX_RETRIES', 2, { min: 0, max: 5 }),
  RAILRADAR_MONTHLY_QUOTA: num('RAILRADAR_MONTHLY_QUOTA', 1000, { min: 1 }),
  RAILRADAR_PER_MINUTE_LIMIT: num('RAILRADAR_PER_MINUTE_LIMIT', 10, { min: 1 }),
  RAILRADAR_QUOTA_RESERVE_PERCENT: num('RAILRADAR_QUOTA_RESERVE_PERCENT', 5, { min: 0, max: 50 }),
  RAILRADAR_BILLING_DAY: num('RAILRADAR_BILLING_DAY', 1, { min: 1, max: 28 }),
  SCHEDULE_REFRESH_DAYS: num('SCHEDULE_REFRESH_DAYS', 30, { min: 1 }),
  FETCH_SCHEDULES_FROM_API: bool('FETCH_SCHEDULES_FROM_API', false),

  // Polling (live mode)
  PRE_POLL_MINUTES: num('PRE_POLL_MINUTES', 20, { min: 1 }),
  POST_CLEAR_POLL_MINUTES: num('POST_CLEAR_POLL_MINUTES', 10, { min: 1 }),
  POLL_INTERVAL_NEAR_SECONDS: num('POLL_INTERVAL_NEAR_SECONDS', 45, { min: 10 }),
  POLL_INTERVAL_MID_SECONDS: num('POLL_INTERVAL_MID_SECONDS', 90, { min: 10 }),
  POLL_INTERVAL_FAR_SECONDS: num('POLL_INTERVAL_FAR_SECONDS', 180, { min: 10 }),
  SCHEDULER_TICK_SECONDS: num('SCHEDULER_TICK_SECONDS', 10, { min: 1 }),

  // Engine
  ENGINE_TICK_SECONDS: num('ENGINE_TICK_SECONDS', 5, { min: 1 }),
  SIMULATION_TICK_MS: num('SIMULATION_TICK_MS', 1000, { min: 200 }),

  // Retention (days) — applied as MongoDB TTL indexes on first index build
  RETENTION_SNAPSHOT_DAYS: num('RETENTION_SNAPSHOT_DAYS', 14, { min: 1 }),
  RETENTION_AUDIT_DAYS: num('RETENTION_AUDIT_DAYS', 60, { min: 1 }),
  RETENTION_ALERT_DAYS: num('RETENTION_ALERT_DAYS', 90, { min: 1 }),
  RETENTION_EVENT_DAYS: num('RETENTION_EVENT_DAYS', 365, { min: 1 })
};

/**
 * Prediction thresholds. These are SOFTWARE PREDICTION thresholds, not verified
 * physical gate timings. Each can be overridden at runtime through the
 * SystemSetting collection (Admin > Settings) or the matching env var.
 */
config.THRESHOLD_DEFAULTS = {
  CLOSING_SOON_THRESHOLD_MINUTES: num('CLOSING_SOON_THRESHOLD_MINUTES', 10, { min: 1, max: 60 }),
  CLOSED_DISTANCE_METERS: num('CLOSED_DISTANCE_METERS', 1200, { min: 100, max: 5000 }),
  CLOSED_ETA_MINUTES: num('CLOSED_ETA_MINUTES', 2.5, { min: 0.5, max: 10 }),
  CLEARANCE_DISTANCE_METERS: num('CLEARANCE_DISTANCE_METERS', 300, { min: 0, max: 2000 }),
  CLEARANCE_BUFFER_SECONDS: num('CLEARANCE_BUFFER_SECONDS', 30, { min: 0, max: 600 }),
  TRAIN_LENGTH_METERS: num('TRAIN_LENGTH_METERS', 550, { min: 50, max: 1500 }),
  BACK_TO_BACK_GAP_SECONDS: num('BACK_TO_BACK_GAP_SECONDS', 120, { min: 0, max: 900 }),
  STALE_DATA_THRESHOLD_SECONDS: num('STALE_DATA_THRESHOLD_SECONDS', 180, { min: 30, max: 3600 }),
  MAX_DEAD_RECKONING_SECONDS: num('MAX_DEAD_RECKONING_SECONDS', 900, { min: 60, max: 7200 }),
  RECENT_DELAY_VALIDITY_MINUTES: num('RECENT_DELAY_VALIDITY_MINUTES', 120, { min: 5, max: 1440 }),
  PREDICTION_LOOKAHEAD_MINUTES: num('PREDICTION_LOOKAHEAD_MINUTES', 90, { min: 10, max: 720 }),
  SCHEDULE_UNCERTAINTY_MINUTES: num('SCHEDULE_UNCERTAINTY_MINUTES', 5, { min: 0, max: 60 }),
  MIN_HISTORICAL_SAMPLES: num('MIN_HISTORICAL_SAMPLES', 5, { min: 2, max: 100 }),
  DEFAULT_CORRIDOR_SPEED_KMH: num('DEFAULT_CORRIDOR_SPEED_KMH', 45, { min: 10, max: 130 }),
  MIN_EFFECTIVE_SPEED_KMH: num('MIN_EFFECTIVE_SPEED_KMH', 10, { min: 1, max: 60 }),
  MAX_TRAIN_SPEED_KMH: num('MAX_TRAIN_SPEED_KMH', 130, { min: 30, max: 200 }),
  DOWNGRADE_CONFIRM_SECONDS: num('DOWNGRADE_CONFIRM_SECONDS', 15, { min: 0, max: 300 }),
  ALERT_COOLDOWN_SECONDS: num('ALERT_COOLDOWN_SECONDS', 600, { min: 0, max: 86400 })
};

config.resolveDataMode = () => {
  if (config.DATA_MODE === 'LIVE' || config.DATA_MODE === 'SIMULATION') return config.DATA_MODE;
  return config.RAILRADAR_API_KEY ? 'LIVE' : 'SIMULATION';
};

module.exports = config;
