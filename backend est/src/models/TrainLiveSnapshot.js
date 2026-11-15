const mongoose = require('mongoose');
const env = require('../config/env');
const { PointSchema, days } = require('./_shared');

/** Every normalized live observation received from RailRadar (never simulated). */
const TrainLiveSnapshotSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true },
  observedAt: { type: Date, required: true },
  receivedAt: { type: Date, default: Date.now },
  location: { type: PointSchema, default: undefined },
  chainageMeters: { type: Number, default: null },
  positionMethod: { type: String, enum: ['GPS', 'ROUTE_DISTANCE', 'STATION', 'NONE'], default: 'NONE' },
  speedKmh: { type: Number, default: null },
  delayMinutes: { type: Number, default: null },
  currentStation: { type: String, default: '' },
  atStation: { type: Boolean, default: false },
  liveStatus: { type: String, default: '' },
  rawPayload: { type: mongoose.Schema.Types.Mixed, select: false }
}, { timestamps: false });

TrainLiveSnapshotSchema.index({ trainNumber: 1, observedAt: -1 }, { unique: true });
TrainLiveSnapshotSchema.index({ receivedAt: 1 }, { expireAfterSeconds: days(env.RETENTION_SNAPSHOT_DAYS) });

module.exports = mongoose.models.TrainLiveSnapshot || mongoose.model('TrainLiveSnapshot', TrainLiveSnapshotSchema);
