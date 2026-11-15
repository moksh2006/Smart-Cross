const { Alert, NotificationSubscription } = require('../models');
const { engine } = require('../services/runtime');
const { intParam, oneOf, BadRequest } = require('../middleware/validate');

exports.list = async (req, res) => {
  const limit = intParam(req.query.limit, { name: 'limit', min: 1, max: 500, def: 50 });
  const mode = oneOf(req.query.mode, ['LIVE', 'SIMULATION'], { name: 'mode', def: engine.mode });
  const q = { mode };
  if (req.query.phatak !== undefined) q.phatakNumbers = intParam(req.query.phatak, { name: 'phatak', min: 1, max: 100000 });
  if (req.query.type) q.type = oneOf(req.query.type, ['GATE_STATUS_CHANGE', 'GROUPED_CLOSURE', 'SYSTEM_WARNING'], { name: 'type' });
  if (req.query.since) {
    const d = new Date(req.query.since);
    if (Number.isNaN(d.getTime())) throw new BadRequest('since must be an ISO date');
    q.createdAt = { $gt: d };
  }
  const alerts = await Alert.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ success: true, data: alerts });
};

exports.subscribe = async (req, res) => {
  const { clientId, phatakNumbers = [], warningMinutes = 10, channels = {} } = req.body || {};
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(clientId)) throw new BadRequest('clientId must be 8-64 letters, digits, - or _');
  if (!Array.isArray(phatakNumbers) || phatakNumbers.length > 50 || !phatakNumbers.every((n) => Number.isInteger(n))) throw new BadRequest('phatakNumbers must be an array of integers');
  const wm = intParam(warningMinutes, { name: 'warningMinutes', min: 1, max: 60 });
  const doc = await NotificationSubscription.findOneAndUpdate(
    { clientId },
    {
      clientId, phatakNumbers, warningMinutes: wm,
      channels: { browser: channels.browser !== false, audio: channels.audio !== false },
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
      lastSeenAt: new Date()
    },
    { upsert: true, new: true, runValidators: true }
  ).lean();
  res.json({ success: true, data: doc });
};
