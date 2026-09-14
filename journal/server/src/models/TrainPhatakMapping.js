const mongoose = require('mongoose');

const TrainPhatakMappingSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, index: true },
  phatakNumber: { type: Number, required: true, index: true },
  routePosition: { type: Number, required: true }, // meters along railway route
  distanceFromRoute: { type: Number, required: true }, // perpendicular distance in meters
  sequence: { type: Number, required: true }, // 1, 2, 3, 4 along the train's route
  direction: {
    type: String,
    enum: ['PATIALA_TO_DHABLAN', 'DHABLAN_TO_PATIALA', 'OTHER_DIRECTION', 'UNKNOWN'],
    required: true
  },
  confidence: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'HIGH'
  },
  isWithinCorridor: { type: Boolean, default: true },
  calculatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

TrainPhatakMappingSchema.index({ trainNumber: 1, phatakNumber: 1 }, { unique: true });

module.exports = mongoose.model('TrainPhatakMapping', TrainPhatakMappingSchema);
