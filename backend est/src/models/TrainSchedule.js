const mongoose = require('mongoose');
const { DIRECTIONS } = require('./_shared');

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const StopSchema = new mongoose.Schema({
  stationCode: { type: String, required: true, uppercase: true, trim: true },
  stationName: { type: String, default: '' },
  arrivalTime: { type: String, default: null, validate: { validator: (v) => v == null || HHMM.test(v), message: 'arrivalTime must be HH:MM' } },
  departureTime: { type: String, default: null, validate: { validator: (v) => v == null || HHMM.test(v), message: 'departureTime must be HH:MM' } },
  dayOffset: { type: Number, default: 0, min: 0 },
  distanceKm: { type: Number, default: null },
  isHalt: { type: Boolean, default: true },
  lat: Number,
  lng: Number
}, { _id: false });

/** Timetable for a monitored train. Source: bundled seed or RailRadar /v1/trains/{n}. */
const TrainScheduleSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, unique: true },
  trainName: { type: String, default: '' },
  runningDays: [{ type: String, enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] }],
  corridorDirection: { type: String, enum: DIRECTIONS, default: 'UNKNOWN' },
  stops: { type: [StopSchema], default: [] },
  source: { type: String, enum: ['BUNDLED_SEED', 'RAILRADAR_API'], default: 'BUNDLED_SEED' },
  verified: { type: Boolean, default: false },
  fetchedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.TrainSchedule || mongoose.model('TrainSchedule', TrainScheduleSchema);
