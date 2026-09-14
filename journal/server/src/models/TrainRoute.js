const mongoose = require('mongoose');

const TrainRouteSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, unique: true, index: true },
  geometry: {
    type: {
      type: String,
      enum: ['LineString'],
      default: 'LineString',
      required: true
    },
    coordinates: {
      type: [[Number]], // [[longitude, latitude], ...]
      required: true
    }
  },
  totalDistanceKm: { type: Number, default: 0 },
  stops: [{
    stationCode: { type: String, required: true },
    stationName: { type: String, default: '' },
    coordinates: { type: [Number] }, // [lon, lat]
    sequence: { type: Number, default: 0 }
  }],
  fetchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: { expires: '7d' } }
}, { timestamps: true });

TrainRouteSchema.index({ geometry: '2dsphere' });

module.exports = mongoose.model('TrainRoute', TrainRouteSchema);
