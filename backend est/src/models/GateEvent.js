const mongoose = require('mongoose');
const env = require('../config/env');
const { GATE_STATES, MODES, PREDICTION_SOURCES, CONFIDENCE, days } = require('./_shared');

/** Predicted gate state transition (software prediction, not a sensor reading). */
const GateEventSchema = new mongoose.Schema({
  mode: { type: String, enum: MODES, required: true },
  phatakNumber: { type: Number, required: true },
  previousStatus: { type: String, enum: GATE_STATES, required: true },
  newStatus: { type: String, enum: GATE_STATES, required: true },
  trainNumber: { type: String, default: null },
  source: { type: String, enum: PREDICTION_SOURCES.concat([null]), default: null },
  confidence: { type: String, enum: CONFIDENCE.concat([null]), default: null },
  reason: { type: String, default: '' },
  previousStateDurationSeconds: { type: Number, default: null },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: false });

GateEventSchema.index({ mode: 1, phatakNumber: 1, timestamp: -1 });
GateEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: days(env.RETENTION_EVENT_DAYS) });

module.exports = mongoose.models.GateEvent || mongoose.model('GateEvent', GateEventSchema);
