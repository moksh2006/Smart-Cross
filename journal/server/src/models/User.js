const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'operator', 'user'], default: 'user' },
  preferredPhataks: [{ type: Number }],
  alertSettings: {
    soundEnabled: { type: Boolean, default: true },
    pushEnabled: { type: Boolean, default: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
