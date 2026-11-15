const analytics = require('../services/analytics/analyticsService');
const { engine } = require('../services/runtime');
const { intParam, oneOf } = require('../middleware/validate');

exports.summary = async (req, res) => {
  const days = intParam(req.query.days, { name: 'days', min: 1, max: 365, def: 7 });
  const mode = oneOf(req.query.mode, ['LIVE', 'SIMULATION'], { name: 'mode', def: engine.mode });
  res.json({ success: true, data: await analytics.summary({ days, mode }) });
};
