const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  endpoint: { type: String, required: true },
  method: { type: String, default: 'GET' },
  trainNumber: { type: String, default: null, index: true },
  requestTime: { type: Date, default: Date.now },
  responseTime: { type: Date, default: null },
  httpStatus: { type: Number, default: 200 },
  success: { type: Boolean, default: true },
  errorCode: { type: String, default: null },
  latencyMs: { type: Number, default: 0 },
  source: { type: String, default: 'RAILRADAR' },
  details: { type: String, default: '' }
}, { timestamps: true });

AuditLogSchema.index({ requestTime: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
