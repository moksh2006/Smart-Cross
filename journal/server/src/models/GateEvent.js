const mongoose = require('mongoose');

const GateEventSchema = new mongoose.Schema({
  phatakNumber: { type: Number, required: true, index: true },
  previousStatus: {
    type: String,
    enum: ['OPEN', 'CLOSING_SOON', 'CLOSED', 'OPENING_SOON', 'UNKNOWN'],
    required: true
  },
  newStatus: {
    type: String,
    enum: ['OPEN', 'CLOSING_SOON', 'CLOSED', 'OPENING_SOON', 'UNKNOWN'],
    required: true
  },
  trainNumber: { type: String, default: null },
  timestamp: { type: Date, default: Date.now, index: true },
  reason: { type: String, default: 'Automatic state machine transition' },
  predictionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PhatakPrediction', default: null },
  soundTriggered: { type: Boolean, default: false },
  durationSeconds: { type: Number, default: 0 }
}, { timestamps: true });

GateEventSchema.index({ phatakNumber: 1, timestamp: -1 });

module.exports = mongoose.model('GateEvent', GateEventSchema);
