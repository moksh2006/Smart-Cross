const mongoose = require('mongoose');

const PhatakSchema = new mongoose.Schema({
  name: { type: String, required: true },
  number: { type: Number, required: true, unique: true, index: true },
  dmsCoordinates: {
    latitude: { type: String, required: true },
    longitude: { type: String, required: true }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  stationCorridor: { type: String, default: 'PTA-DBN' },
  currentStatus: {
    type: String,
    enum: ['OPEN', 'CLOSING_SOON', 'CLOSED', 'OPENING_SOON', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  activeTrainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Train', default: null },
  activeTrainNumber: { type: String, default: null },
  alertRadius: { type: Number, default: 1500 },
  routeCorridorMeters: { type: Number, default: 100 },
  statusUpdatedAt: { type: Date, default: Date.now },
  nearestRoutePoint: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number]
  },
  distanceFromTrackMeters: { type: Number, default: 0 },
  routePositionMeters: { type: Number, default: 0 },
  calculatedDistances: {
    type: Map,
    of: Number, // distance in meters to other phataks
    default: {}
  }
}, { timestamps: true });

PhatakSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Phatak', PhatakSchema);
