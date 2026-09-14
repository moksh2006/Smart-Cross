const mongoose = require('mongoose');

const TrainScheduleSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, unique: true, index: true },
  trainName: { type: String, default: '' },
  runningDays: [{ type: String }],
  stations: [{
    stationCode: { type: String, required: true },
    stationName: { type: String, default: '' },
    arrivalTime: { type: String, default: '--' },
    departureTime: { type: String, default: '--' },
    distanceKm: { type: Number, default: 0 },
    haltMinutes: { type: Number, default: 0 },
    dayCount: { type: Number, default: 1 },
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  }],
  patialaSchedule: {
    stationCode: { type: String, default: 'PTA' },
    stationName: { type: String, default: 'Patiala' },
    arrivalTime: { type: String, default: '--' },
    departureTime: { type: String, default: '--' },
    haltMinutes: { type: Number, default: 2 },
    dayCount: { type: Number, default: 1 }
  },
  dhablanSchedule: {
    stationCode: { type: String, default: 'DBN' },
    stationName: { type: String, default: 'Dhablan' },
    arrivalTime: { type: String, default: '--' },
    departureTime: { type: String, default: '--' },
    haltMinutes: { type: Number, default: 1 },
    dayCount: { type: Number, default: 1 }
  },
  corridorDirection: {
    type: String,
    enum: ['PATIALA_TO_DHABLAN', 'DHABLAN_TO_PATIALA', 'OTHER_DIRECTION', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  entryStationCode: { type: String, default: '' },
  entryScheduledTime: { type: String, default: '--' },
  exitStationCode: { type: String, default: '' },
  exitScheduledTime: { type: String, default: '--' },
  fetchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: { expires: '24h' } }
}, { timestamps: true });

module.exports = mongoose.model('TrainSchedule', TrainScheduleSchema);
