const { simulation, engine } = require('../services/runtime');
const env = require('../config/env');
const { MODE } = require('../config/constants');
const { BadRequest } = require('../middleware/validate');

exports.status = (req, res) => res.json({ success: true, data: simulation.status() });

exports.addTrain = async (req, res) => {
  const train = await simulation.addTrain(req.body || {});
  res.status(201).json({ success: true, data: { train, status: simulation.status() } });
};

exports.updateTrain = (req, res) => {
  const train = simulation.updateTrain(req.params.id, req.body || {});
  res.json({ success: true, data: { train, status: simulation.status() } });
};

exports.removeTrain = (req, res) => {
  simulation.removeTrain(req.params.id);
  res.json({ success: true, data: simulation.status() });
};

exports.scenario = async (req, res) => {
  const data = await simulation.startScenario(req.params.name);
  res.json({ success: true, data: { ...data, status: simulation.status() } });
};

/** Start: either { scenario } or { trains: [spec, ...] }. */
exports.start = async (req, res) => {
  const body = req.body || {};
  if (body.scenario) return exports.scenario({ params: { name: body.scenario } }, res);
  if (!Array.isArray(body.trains) || !body.trains.length) throw new BadRequest('Provide scenario or a non-empty trains array');
  await simulation.reset();
  for (const spec of body.trains) await simulation.addTrain(spec);
  return res.json({ success: true, data: simulation.status() });
};

exports.pause = (req, res) => { simulation.stop(); res.json({ success: true, data: simulation.status() }); };
exports.resume = (req, res) => { simulation.resume(); res.json({ success: true, data: simulation.status() }); };

exports.reset = async (req, res) => { await simulation.reset(); res.json({ success: true, data: simulation.status() }); };

/** Stop simulation entirely and return to LIVE mode when available. */
exports.stop = async (req, res) => {
  await simulation.reset();
  if (env.RAILRADAR_API_KEY && engine.mode !== MODE.LIVE) {
    await engine.setMode(MODE.LIVE, { actor: 'admin', reason: 'Simulation stopped' });
  }
  res.json({ success: true, data: simulation.status() });
};
