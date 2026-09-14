const mongoose = require('mongoose');

const HistoricalTrainObservationSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, index: true },
  phatakNumber: { type: Number, required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  dayOfWeek: { type: String, default: '' },
  observedAt: { type: Date, default: Date.now },
  trainRoutePosition: { type: Number, default: 0 },
  speed: { type: Number, default: 0 },
  predictedArrival: { type: Date, default: null },
  actualArrival: { type: Date, default: null },
  predictionErrorSeconds: { type: Number, default: null },
  delay: { type: Number, default: 0 },
  direction: {
    type: String,
    enum: ['PATIALA_TO_DHABLAN', 'DHABLAN_TO_PATIALA', 'OTHER_DIRECTION', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  travelTimeFromPTASeconds: { type: Number, default: null },
  travelTimeFromDBNSeconds: { type: Number, default: null },
  source: {
    type: String,
    enum: ['LIVE_API', 'LIVE_MAP', 'SIMULATION', 'HISTORICAL'],
    default: 'LIVE_API'
  }
}, { timestamps: true });

HistoricalTrainObservationSchema.index({ phatakNumber: 1, trainNumber: 1, observedAt: -1 });

module.exports = mongoose.model('HistoricalTrainObservation', HistoricalTrainObservationSchema);
