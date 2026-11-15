const settings = require('../services/settings/settingsService');
const { engine } = require('../services/runtime');
const { BadRequest } = require('../middleware/validate');

exports.get = (req, res) => res.json({ success: true, data: settings.describe() });

exports.update = async (req, res) => {
  const { key, value } = req.body || {};
  if (typeof key !== 'string') throw new BadRequest('key is required');
  const data = await settings.update(key, value, 'admin');
  await engine.evaluate();
  res.json({ success: true, data });
};

exports.reset = async (req, res) => {
  const data = await settings.reset(req.params.key, 'admin');
  await engine.evaluate();
  res.json({ success: true, data });
};
