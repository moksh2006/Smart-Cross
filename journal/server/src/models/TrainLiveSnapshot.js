const mongoose = require('mongoose');

const TrainLiveSnapshotSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, index: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  speed: { type: Number, default: 0 },
  delayMinutes: { type: Number, default: 0 },
  currentStation: { type: String, default: '' },
  nextStation: { type: String, default: '' },
  status: { type: String, default: 'ACTIVE' },
  dataSource: {
    type: String,
    enum: ['LIVE_API', 'LIVE_MAP', 'LATEST_OBSERVATION', 'HISTORICAL', 'TIMETABLE', 'SIMULATION'],
    default: 'LIVE_API'
  },
  observedAt: { type: Date, default: Date.now, index: true },
  rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

TrainLiveSnapshotSchema.index({ location: '2dsphere' });
TrainLiveSnapshotSchema.index({ trainNumber: 1, observedAt: -1 });

module.exports = mongoose.model('TrainLiveSnapshot', TrainLiveSnapshotSchema);
