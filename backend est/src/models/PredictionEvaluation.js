const mongoose = require('mongoose');
const env = require('../config/env');
const { MODES, PREDICTION_SOURCES, days } = require('./_shared');

/** Error of each logged prediction once the actual crossing passage was observed. */
const PredictionEvaluationSchema = new mongoose.Schema({
  mode: { type: String, enum: MODES, required: true },
  serviceDate: { type: String, required: true },
  trainNumber: { type: String, required: true },
  phatakNumber: { type: Number, required: true },
  horizonMinutes: { type: Number, required: true },
  source: { type: String, enum: PREDICTION_SOURCES, required: true },
  predictedArrival: { type: Date, required: true },
  observedArrival: { type: Date, required: true },
  errorSeconds: { type: Number, required: true },        // predicted - observed (positive = predicted late)
  absoluteErrorSeconds: { type: Number, required: true },
  evaluatedAt: { type: Date, default: Date.now }
}, { timestamps: false });

PredictionEvaluationSchema.index({ mode: 1, serviceDate: 1, trainNumber: 1, phatakNumber: 1, horizonMinutes: 1 }, { unique: true });
PredictionEvaluationSchema.index({ evaluatedAt: 1 }, { expireAfterSeconds: days(env.RETENTION_EVENT_DAYS) });

module.exports = mongoose.models.PredictionEvaluation || mongoose.model('PredictionEvaluation', PredictionEvaluationSchema);
