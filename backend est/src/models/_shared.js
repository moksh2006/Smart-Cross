/** Shared schema fragments and enums for SmartCross models. */
const mongoose = require('mongoose');

const GATE_STATES = ['OPEN', 'CLOSING_SOON', 'CLOSED', 'OPENING_SOON', 'UNKNOWN'];
const DIRECTIONS = ['PATIALA_TO_DHABLAN', 'DHABLAN_TO_PATIALA', 'UNKNOWN'];
const CONFIDENCE = ['HIGH', 'MEDIUM', 'LOW', 'NONE'];
const PREDICTION_SOURCES = [
  'LIVE_POSITION',
  'LATEST_OBSERVATION',
  'TIMETABLE_WITH_DELAY',
  'HISTORICAL_AVERAGE',
  'TIMETABLE_ESTIMATE',
  'UNKNOWN'
];
const DATA_SOURCES = ['LIVE_API', 'SIMULATION', 'TIMETABLE', 'HISTORICAL', 'NONE'];
const MODES = ['LIVE', 'SIMULATION'];

const PointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: {
    type: [Number],
    validate: {
      validator: (v) => Array.isArray(v) && v.length === 2 &&
        v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90,
      message: 'coordinates must be [longitude, latitude]'
    }
  }
}, { _id: false });

const days = (n) => Math.round(n * 24 * 3600);

module.exports = { GATE_STATES, DIRECTIONS, CONFIDENCE, PREDICTION_SOURCES, DATA_SOURCES, MODES, PointSchema, days };
