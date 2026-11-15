const mongoose = require('mongoose');
const env = require('../config/env');
const { DIRECTIONS, MODES, days } = require('./_shared');

/**
 * One observed passage of a train over a crossing, derived from position data
 * (live RailRadar telemetry or simulation — never from timetable estimates).
 * Live records feed fallback level 4 (historical average) and analytics.
 */
const HistoricalTrainObservationSchema = new mongoose.Schema({
  mode: { type: String, enum: MODES, required: true },
  serviceDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}(#[A-Za-z0-9]+)?$/ },
  dayOfWeek: { type: String, enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] },
  trainNumber: { type: String, required: true },
  phatakNumber: { type: Number, required: true },
  direction: { type: String, enum: DIRECTIONS, default: 'UNKNOWN' },
  observedArrival: { type: Date, required: true },
  speedKmh: { type: Number, default: null },
  delayMinutes: { type: Number, default: null },
  scheduledEntryTime: { type: Date, default: null },
  offsetFromScheduledEntrySeconds: { type: Number, default: null },
  estimatedClosureSeconds: { type: Number, default: null }
}, { timestamps: true });

HistoricalTrainObservationSchema.index({ mode: 1, serviceDate: 1, trainNumber: 1, phatakNumber: 1 }, { unique: true });
HistoricalTrainObservationSchema.index({ mode: 1, trainNumber: 1, phatakNumber: 1, observedArrival: -1 });
HistoricalTrainObservationSchema.index({ createdAt: 1 }, { expireAfterSeconds: days(env.RETENTION_EVENT_DAYS) });

module.exports = mongoose.models.HistoricalTrainObservation ||
  mongoose.model('HistoricalTrainObservation', HistoricalTrainObservationSchema);
