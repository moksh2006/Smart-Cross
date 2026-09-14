const mongoose = require('mongoose');

const PhatakPredictionSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, index: true },
  phatakNumber: { type: Number, required: true, index: true },
  predictedArrival: { type: Date, required: true },
  predictedClosure: { type: Date, required: true },
  predictedOpening: { type: Date, required: true },
  waitingTimeMinutes: { type: Number, default: 0 },
  distanceToPhatakMeters: { type: Number, default: 0 },
  distanceMeters: { type: Number, default: 0 },
  etaMinutes: { type: Number, default: 0 },
  hasPassed: { type: Boolean, default: false },
  confidence: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  method: {
    type: String,
    enum: [
      'LIVE_POSITION',
      'LATEST_OBSERVATION',
      'TIMETABLE_WITH_DELAY',
      'HISTORICAL_AVERAGE',
      'TIMETABLE_ESTIMATE',
      'UNKNOWN'
    ],
    default: 'LIVE_POSITION'
  },
  dataSource: {
    type: String,
    enum: ['LIVE_API', 'LIVE_MAP', 'LATEST_OBSERVATION', 'HISTORICAL', 'TIMETABLE', 'SIMULATION'],
    default: 'LIVE_API'
  },
  trainStatus: { type: String, default: 'SCHEDULED' },
  inCorridor: { type: Boolean, default: false },
  speedKmh: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true, index: true },
  calculatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

PhatakPredictionSchema.index({ phatakNumber: 1, isActive: 1 });

module.exports = mongoose.model('PhatakPrediction', PhatakPredictionSchema);
