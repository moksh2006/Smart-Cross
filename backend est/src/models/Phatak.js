const mongoose = require('mongoose');
const { GATE_STATES, PointSchema } = require('./_shared');

/** A monitored railway level crossing ("phatak"). Seeded from config/corridor.js. */
const PhatakSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true, min: 1 },
  name: { type: String, required: true, trim: true },
  dmsCoordinates: { latitude: String, longitude: String },
  location: { type: PointSchema, required: true },
  group: { type: String, default: null },
  stationCorridor: { type: String, default: 'PTA-DBN' },
  chainageMeters: { type: Number, required: true },
  distanceFromTrackMeters: { type: Number, default: 0 },
  nearestRoutePoint: { type: PointSchema, default: undefined },
  // Last predicted state (persisted so restarts and REST reads see it)
  currentStatus: { type: String, enum: GATE_STATES, default: 'UNKNOWN' },
  statusMode: { type: String, enum: ['LIVE', 'SIMULATION'], default: 'LIVE' },
  statusReason: { type: String, default: '' },
  activeTrainNumber: { type: String, default: null },
  statusUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

PhatakSchema.index({ location: '2dsphere' });

module.exports = mongoose.models.Phatak || mongoose.model('Phatak', PhatakSchema);
