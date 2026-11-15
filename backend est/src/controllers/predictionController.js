const { engine } = require('../services/runtime');
const { intParam } = require('../middleware/validate');

exports.list = (req, res) => {
  const phatak = req.query.phatak !== undefined ? intParam(req.query.phatak, { name: 'phatak', min: 1, max: 100000 }) : null;
  const out = [];
  for (const r of engine.lastTrainResults.values()) {
    for (const p of r.predictions) {
      if (phatak !== null && p.phatakNumber !== phatak) continue;
      if (p.status === 'PASSED' && p.cleared) continue;
      out.push(engine.predictionView(p));
    }
  }
  out.sort((a, b) => (a.etaSeconds ?? 1e9) - (b.etaSeconds ?? 1e9));
  res.json({ success: true, data: { mode: engine.mode, calculatedAt: engine.lastEvaluatedAt, predictions: out } });
};

exports.recalculate = async (req, res) => {
  await engine.evaluate();
  res.json({ success: true, data: engine.snapshot() });
};
