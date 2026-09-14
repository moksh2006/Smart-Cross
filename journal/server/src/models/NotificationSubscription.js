const mongoose = require('mongoose');

const NotificationSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, default: '' },
    auth: { type: String, default: '' }
  },
  phatakNumbers: [{ type: Number }],
  browserInfo: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('NotificationSubscription', NotificationSubscriptionSchema);
