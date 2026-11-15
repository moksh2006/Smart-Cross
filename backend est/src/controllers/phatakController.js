const corridor = require('../config/corridor');
const { engine } = require('../services/runtime');
const { GateEvent, Alert } = require('../models');
const { haversineDistance } = require('../services/gis/distanceCalculator');
const { intParam, numParam, BadRequest } = require('../middleware/validate');

exports.list = (req, res) => {
  res.json({ success: true, data: corridor.CROSSINGS.map((c) => engine.crossingView(c)) });
};

exports.nearby = (req, res) => {
  const lat = numParam(req.query.lat, { name: 'lat', min: -90, max: 90 });
  const lon = numParam(req.query.lon, { name: 'lon', min: -180, max: 180 });
  const radius = numParam(req.query.radius, { name: 'radius', min: 1, max: 100000, def: 5000 });
  const data = corridor.CROSSINGS
    .map((c) => ({ ...engine.crossingView(c), distanceMeters: Math.round(haversineDistance([lon, lat], c.coordinates)) }))
    .filter((c) => c.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  res.json({ success: true, data });
};

exports.detail = async (req, res) => {
  const number = intParam(req.params.number, { name: 'number', min: 1, max: 100000 });
  const c = corridor.getCrossing(number);
  if (!c) throw Object.assign(new BadRequest(`Phatak ${number} is not monitored`), { status: 404 });
  const [events, alerts] = await Promise.all([
    GateEvent.find({ mode: engine.mode, phatakNumber: number }).sort({ timestamp: -1 }).limit(30).lean(),
    Alert.find({ mode: engine.mode, phatakNumbers: number }).sort({ createdAt: -1 }).limit(20).lean()
  ]);
  const group = corridor.GROUPS.find((g) => g.crossings.includes(number)) || null;
  const advisories = engine.advisories.filter((a) => a.sequence.includes(number));
  res.json({
    success: true,
    data: {
      ...engine.crossingView(c),
      dms: c.dms,
      distanceFromTrackMeters: c.offTrackMeters,
      groupInfo: group,
      neighbours: group ? group.crossings.filter((n) => n !== number).map((n) => ({ number: n, state: engine.gsm.get(n).state })) : [],
      advisories,
      recentGateEvents: events,
      recentAlerts: alerts
    }
  });
};
