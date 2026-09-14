const mongoose = require('mongoose');

const SystemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String, default: '' },
  updatedBy: { type: String, default: 'SYSTEM' },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', SystemSettingSchema);
