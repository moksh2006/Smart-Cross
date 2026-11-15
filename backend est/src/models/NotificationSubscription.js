const mongoose = require('mongoose');

/** Per-browser notification preferences (anonymous client id generated in the browser). */
const NotificationSubscriptionSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true, match: /^[A-Za-z0-9_-]{8,64}$/ },
  phatakNumbers: { type: [Number], default: [] },
  warningMinutes: { type: Number, default: 10, min: 1, max: 60 },
  channels: {
    browser: { type: Boolean, default: true },
    audio: { type: Boolean, default: true }
  },
  userAgent: { type: String, default: '', maxlength: 300 },
  lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.NotificationSubscription ||
  mongoose.model('NotificationSubscription', NotificationSubscriptionSchema);
