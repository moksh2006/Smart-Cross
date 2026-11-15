const mongoose = require('mongoose');
const env = require('../config/env');
const { days } = require('./_shared');

/** External API calls (RailRadar) and administrative actions. */
const AuditLogSchema = new mongoose.Schema({
  category: { type: String, enum: ['EXTERNAL_API', 'ADMIN_ACTION', 'SYSTEM'], required: true },
  action: { type: String, required: true },
  endpoint: { type: String, default: null },
  trainNumber: { type: String, default: null },
  httpStatus: { type: Number, default: null },
  success: { type: Boolean, default: true },
  errorCode: { type: String, default: null },
  latencyMs: { type: Number, default: null },
  actor: { type: String, default: 'SYSTEM' },
  details: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false });

AuditLogSchema.index({ category: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: days(env.RETENTION_AUDIT_DAYS) });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
