const mongoose = require('mongoose');
const env = require('../config/env');
const { MODES, days } = require('./_shared');

const AlertSchema = new mongoose.Schema({
  mode: { type: String, enum: MODES, required: true },
  type: { type: String, enum: ['GATE_STATUS_CHANGE', 'GROUPED_CLOSURE', 'SYSTEM_WARNING'], required: true },
  severity: { type: String, enum: ['INFO', 'WARNING', 'CRITICAL', 'SUCCESS'], required: true },
  phatakNumbers: { type: [Number], default: [] },
  trainNumber: { type: String, default: null },
  status: { type: String, default: null },
  title: { type: String, required: true, maxlength: 200 },
  message: { type: String, required: true, maxlength: 1000 },
  dedupeKey: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false });

AlertSchema.index({ mode: 1, createdAt: -1 });
AlertSchema.index({ dedupeKey: 1, createdAt: -1 });
AlertSchema.index({ createdAt: 1 }, { expireAfterSeconds: days(env.RETENTION_ALERT_DAYS) });

module.exports = mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
