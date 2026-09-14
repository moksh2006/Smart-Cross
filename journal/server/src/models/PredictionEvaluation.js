const mongoose = require('mongoose');

const PredictionEvaluationSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
  meanAbsoluteErrorSeconds: { type: Number, default: 0 },
  totalEvaluations: { type: Number, default: 0 },
  maeByTrain: {
    type: Map,
    of: Number,
    default: {}
  },
  maeByPhatak: {
    type: Map,
    of: Number,
    default: {}
  },
  maeByDirection: {
    type: Map,
    of: Number,
    default: {}
  },
  maeLiveApi: { type: Number, default: 0 },
  maeFallback: { type: Number, default: 0 },
  averageAlertLeadTimeSeconds: { type: Number, default: 0 },
  averageNotificationLatencyMs: { type: Number, default: 0 },
  averageWebSocketLatencyMs: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('PredictionEvaluation', PredictionEvaluationSchema);
