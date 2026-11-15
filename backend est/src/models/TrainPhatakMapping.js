const mongoose = require('mongoose');
const { DIRECTIONS } = require('./_shared');

/** Static relationship between a train's route and each crossing (sequence along its direction). */
const TrainPhatakMappingSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true },
  phatakNumber: { type: Number, required: true },
  direction: { type: String, enum: DIRECTIONS, required: true },
  sequence: { type: Number, required: true, min: 1 },
  crossingChainageMeters: { type: Number, required: true },
  distanceFromEntryMeters: { type: Number, required: true },
  calculatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

TrainPhatakMappingSchema.index({ trainNumber: 1, phatakNumber: 1 }, { unique: true });

module.exports = mongoose.models.TrainPhatakMapping || mongoose.model('TrainPhatakMapping', TrainPhatakMappingSchema);
