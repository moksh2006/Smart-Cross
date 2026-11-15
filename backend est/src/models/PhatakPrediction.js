const mongoose = require('mongoose');
const { CONFIDENCE, PREDICTION_SOURCES, DIRECTIONS, MODES, days } = require('./_shared');

/** Current prediction for one train at one crossing (one document per mode/train/crossing). */
const PhatakPredictionSchema = new mongoose.Schema({
  mode: { type: String, enum: MODES, required: true },
  trainNumber: { type: String, required: true },
  trainName: { type: String, default: '' },
  phatakNumber: { type: Number, required: true },
  direction: { type: String, enum: DIRECTIONS, default: 'UNKNOWN' },
  source: { type: String, enum: PREDICTION_SOURCES, required: true },
  confidence: { type: String, enum: CONFIDENCE, required: true },
  status: { type: String, enum: ['APPROACHING', 'AT_CROSSING', 'PASSED', 'DUE', 'UNKNOWN'], default: 'APPROACHING' },
  distanceMeters: { type: Number, default: null },
  etaSeconds: { type: Number, default: null },
  predictedArrival: { type: Date, default: null },
  predictedClosureStart: { type: Date, default: null },
  predictedReopen: { type: Date, default: null },
  closureDurationSeconds: { type: Number, default: null },
  effectiveSpeedKmh: { type: Number, default: null },
  dataAgeSeconds: { type: Number, default: null },
  isActive: { type: Boolean, default: true },
  calculatedAt: { type: Date, required: true }
}, { timestamps: true });

PhatakPredictionSchema.index({ mode: 1, trainNumber: 1, phatakNumber: 1 }, { unique: true });
PhatakPredictionSchema.index({ mode: 1, phatakNumber: 1, isActive: 1 });
PhatakPredictionSchema.index({ calculatedAt: 1 }, { expireAfterSeconds: days(2) });

module.exports = mongoose.models.PhatakPrediction || mongoose.model('PhatakPrediction', PhatakPredictionSchema);
