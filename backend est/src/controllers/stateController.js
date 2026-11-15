const corridor = require('../config/corridor');
const { engine } = require('../services/runtime');

exports.getState = (req, res) => res.json({ success: true, data: engine.snapshot() });

exports.getCorridor = (req, res) => res.json({
  success: true,
  data: {
    stations: corridor.STATIONS,
    crossings: corridor.CROSSINGS.map((c) => ({
      number: c.number, name: c.name, coordinates: c.coordinates, dms: c.dms, group: c.group,
      chainageMeters: c.chainage, distanceFromTrackMeters: c.offTrackMeters
    })),
    groups: corridor.GROUPS,
    directions: Object.values(corridor.DIRECTIONS).map((d) => ({
      key: d.key, label: d.label, short: d.short,
      sequence: [d.from, ...corridor.crossingOrder(d.key).map((c) => c.number), d.to]
    })),
    geometry: corridor.geometryForClient()
  }
});
