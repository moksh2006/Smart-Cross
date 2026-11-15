const mongoose = require('mongoose');

/** Runtime-tunable settings (thresholds, monitored trains, data mode). */
const SystemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, match: /^[A-Z0-9_]{2,64}$/ },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String, default: '' },
  updatedBy: { type: String, default: 'SYSTEM' }
}, { timestamps: true });

module.exports = mongoose.models.SystemSetting || mongoose.model('SystemSetting', SystemSettingSchema);
