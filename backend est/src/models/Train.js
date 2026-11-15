const mongoose = require('mongoose');
const { DIRECTIONS, PointSchema } = require('./_shared');

/** Real (non-simulated) monitored train and its last known live state. */
const TrainSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, unique: true, match: /^[0-9A-Za-z\-_/ ]{1,20}$/ },
  trainName: { type: String, default: '' },
  sourceStation: { code: String, name: String },
  destinationStation: { code: String, name: String },
  runningDays: [{ type: String, enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] }],
  direction: { type: String, enum: DIRECTIONS, default: 'UNKNOWN' },
  isMonitored: { type: Boolean, default: true },
  // Latest live observation summary (null until RailRadar returns data)
  currentLocation: { type: PointSchema, default: null },
  chainageMeters: { type: Number, default: null },
  speedKmh: { type: Number, default: null, min: 0 },
  delayMinutes: { type: Number, default: null },
  delayObservedAt: { type: Date, default: null },
  currentStation: { type: String, default: '' },
  liveStatus: { type: String, default: '' },
  lastObservedAt: { type: Date, default: null },
  lastPolledAt: { type: Date, default: null },
  lastPollError: { type: String, default: null }
}, { timestamps: true });

TrainSchema.index({ currentLocation: '2dsphere' }, { sparse: true });

module.exports = mongoose.models.Train || mongoose.model('Train', TrainSchema);
