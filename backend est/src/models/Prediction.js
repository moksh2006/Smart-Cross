const mongoose = require('mongoose');
const env = require('../config/env');
const { CONFIDENCE, PREDICTION_SOURCES, MODES, days } = require('./_shared');

/**
 * Prediction history log: a sample of each train/crossing prediction at fixed
 * horizons (15, 10, 5, 2 minutes before predicted arrival). Used to evaluate
 * prediction accuracy once the actual passage is observed.
 */
const PredictionSchema = new mongoose.Schema({
  mode: { type: String, enum: MODES, required: true },
  serviceDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}(#[A-Za-z0-9]+)?$/ },
  trainNumber: { type: String, required: true },
  phatakNumber: { type: Number, required: true },
  horizonMinutes: { type: Number, required: true },
  source: { type: String, enum: PREDICTION_SOURCES, required: true },
  confidence: { type: String, enum: CONFIDENCE, required: true },
  predictedArrival: { type: Date, required: true },
  recordedAt: { type: Date, default: Date.now }
}, { timestamps: false });

PredictionSchema.index({ mode: 1, serviceDate: 1, trainNumber: 1, phatakNumber: 1, horizonMinutes: 1 }, { unique: true });
PredictionSchema.index({ recordedAt: 1 }, { expireAfterSeconds: days(env.RETENTION_EVENT_DAYS) });

module.exports = mongoose.models.Prediction || mongoose.model('Prediction', PredictionSchema);
