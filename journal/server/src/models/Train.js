const mongoose = require('mongoose');

const TrainSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, unique: true, index: true },
  trainName: { type: String, default: 'Indian Railways Express' },
  sourceStation: {
    code: { type: String, default: '' },
    name: { type: String, default: '' }
  },
  destinationStation: {
    code: { type: String, default: '' },
    name: { type: String, default: '' }
  },
  runningDays: [{ type: String }],
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [76.4102, 30.3385] // Default at PTA
    }
  },
  speed: { type: Number, default: 0 }, // km/h
  delayMinutes: { type: Number, default: 0 },
  direction: {
    type: String,
    enum: ['PATIALA_TO_DHABLAN', 'DHABLAN_TO_PATIALA', 'OTHER_DIRECTION', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  status: {
    type: String,
    default: 'SCHEDULED'
  },
  inCorridor: { type: Boolean, default: false },
  isApproaching: { type: Boolean, default: false },
  scheduledProgress: { type: Number, default: 0 },
  routePositionMeters: { type: Number, default: 0 },
  nextPhatakNumber: { type: Number, default: null },
  distanceToNextPhatakMeters: { type: Number, default: null },
  etaToNextPhatakMinutes: { type: Number, default: null },
  isMonitored: { type: Boolean, default: true },
  dataSource: {
    type: String,
    enum: ['LIVE_API', 'LIVE_MAP', 'LATEST_OBSERVATION', 'HISTORICAL', 'TIMETABLE', 'SIMULATION'],
    default: 'TIMETABLE'
  },
  lastUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

TrainSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('Train', TrainSchema);
