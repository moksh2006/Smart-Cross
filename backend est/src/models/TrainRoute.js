const mongoose = require('mongoose');

/** Cached route geometry and stop distances for a train (RailRadar /v1/trains/{n}/route or live route array). */
const TrainRouteSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, unique: true },
  geometry: {
    type: { type: String, enum: ['LineString'], default: 'LineString' },
    coordinates: { type: [[Number]], default: undefined }
  },
  stops: [{
    _id: false,
    sequence: Number,
    stationCode: { type: String, uppercase: true },
    stationName: String,
    distanceKm: Number,
    lat: Number,
    lng: Number
  }],
  source: { type: String, default: 'RAILRADAR_API' },
  fetchedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.TrainRoute || mongoose.model('TrainRoute', TrainRouteSchema);
