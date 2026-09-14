const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  phatakNumber: { type: Number, required: true, index: true },
  trainNumber: { type: String, default: null },
  type: {
    type: String,
    enum: ['GATE_STATUS_CHANGE', 'TRAIN_APPROACHING', 'GROUPED_CLOSURE', 'SYSTEM_WARNING'],
    default: 'GATE_STATUS_CHANGE'
  },
  severity: {
    type: String,
    enum: ['INFO', 'WARNING', 'CRITICAL', 'SUCCESS'],
    required: true
  },
  message: { type: String, required: true },
  soundTrigger: { type: Boolean, default: false },
  deliveredAt: { type: Date, default: null },
  latencyMs: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

AlertSchema.index({ phatakNumber: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', AlertSchema);
