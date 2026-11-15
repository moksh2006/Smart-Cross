/**
 * Central corridor configuration: stations, crossings, groups, directions and
 * track geometry. The prediction engine never hard-codes crossing numbers —
 * to add a crossing, append it to CROSSINGS (and optionally to a group).
 *
 * Linear referencing ("chainage"):
 *   s = 0 at Patiala station (PTA), increasing towards Dhablan (DBN).
 *   s < 0 is east of PTA (towards Rajpura), s > s(DBN) is west of DBN (towards Nabha).
 *   A PATIALA_TO_DHABLAN train has increasing s; DHABLAN_TO_PATIALA decreasing s.
 *
 * Verification (see README > GIS verification): all four crossing coordinates
 * lie within 1–3 m of a node of the OpenStreetMap railway line used below.
 */
const track = require('../data/corridorTrack.json');
const {
  projectPointOnTrack,
  cumulativeDistances,
  pointAtDistance,
  bearingAtDistance
} = require('../services/gis/routeGeometryProcessor');

const DIRECTIONS = {
  PATIALA_TO_DHABLAN: { key: 'PATIALA_TO_DHABLAN', label: 'Patiala → Dhablan', short: 'PTA→DBN', sign: 1, from: 'PTA', to: 'DBN' },
  DHABLAN_TO_PATIALA: { key: 'DHABLAN_TO_PATIALA', label: 'Dhablan → Patiala', short: 'DBN→PTA', sign: -1, from: 'DBN', to: 'PTA' }
};

const CROSSINGS_CONFIG = [
  { number: 19, name: 'Station Approach', lat: 30.339583, lon: 76.398417, dms: { lat: `30°20'22.5"N`, lon: `76°23'54.3"E` }, group: 'A' },
  { number: 20, name: 'Sirhind Road', lat: 30.339667, lon: 76.392583, dms: { lat: `30°20'22.8"N`, lon: `76°23'33.3"E` }, group: 'A' },
  { number: 23, name: 'Model Town Extension', lat: 30.340222, lon: 76.366583, dms: { lat: `30°20'24.8"N`, lon: `76°21'59.7"E` }, group: 'B' },
  { number: 24, name: 'Dhablan Approach', lat: 30.339972, lon: 76.356778, dms: { lat: `30°20'23.9"N`, lon: `76°21'24.4"E` }, group: 'B' }
];

const GROUPS_CONFIG = [
  { id: 'A', name: 'Group A (Phatak 19 & 20)', crossings: [19, 20] },
  { id: 'B', name: 'Group B (Phatak 23 & 24)', crossings: [23, 24] }
];

// Approximate regional extensions (display / dead-reckoning only, NOT used for
// crossing predictions). Coarse points along the Rajpura and Nabha lines.
const COARSE_EAST_FROM_OSM_END = [
  [76.475, 30.38], [76.515, 30.415], [76.554, 30.449], [76.5941, 30.4839]
];
const COARSE_WEST_FROM_OSM_END = [
  [76.151, 30.375], [76.01, 30.372], [75.867, 30.368]
];

const STATION_POINTS = {
  PTA: { code: 'PTA', name: 'Patiala', coordinates: track.corridor[0] },
  DBN: { code: 'DBN', name: 'Dhablan', coordinates: track.corridor[track.corridor.length - 1] }
};

// Build the regional line ordered by increasing chainage (east -> west).
const eastPart = [...COARSE_EAST_FROM_OSM_END].reverse().concat([...track.eastOfPta].reverse()); // ends at PTA
const westPart = track.westBeyondDbn.slice(1).concat(COARSE_WEST_FROM_OSM_END);
const REGIONAL_LINE = eastPart.slice(0, -1).concat(track.corridor, westPart);
const REGIONAL_CUM = cumulativeDistances(REGIONAL_LINE);
const PTA_INDEX = eastPart.length - 1;
const PTA_OFFSET = REGIONAL_CUM[PTA_INDEX];

const CORRIDOR_CUM = cumulativeDistances(track.corridor);
const CORRIDOR_LENGTH_M = CORRIDOR_CUM[CORRIDOR_CUM.length - 1];

/** Chainage (m from PTA) and off-track distance for a [lon, lat] point. */
function chainageOf(coordinates) {
  const proj = projectPointOnTrack(coordinates, REGIONAL_LINE, REGIONAL_CUM);
  return {
    chainage: Math.round((proj.distanceAlongRouteMeters - PTA_OFFSET) * 10) / 10,
    offTrackMeters: proj.distanceFromTrackMeters,
    snapped: proj.nearestPoint
  };
}

/** [lon, lat] on the railway for a chainage value. */
function pointAtChainage(chainage) {
  return pointAtDistance(REGIONAL_LINE, chainage + PTA_OFFSET, REGIONAL_CUM);
}

/** Track bearing at a chainage for the given direction of travel. */
function headingAtChainage(chainage, direction) {
  const b = bearingAtDistance(REGIONAL_LINE, chainage + PTA_OFFSET, REGIONAL_CUM);
  return direction === 'DHABLAN_TO_PATIALA' ? (b + 180) % 360 : b;
}

const CROSSINGS = CROSSINGS_CONFIG.map((c) => {
  const { chainage, offTrackMeters, snapped } = chainageOf([c.lon, c.lat]);
  return { ...c, coordinates: [c.lon, c.lat], chainage, offTrackMeters, snappedPoint: snapped };
}).sort((a, b) => a.chainage - b.chainage);

const STATIONS = {
  PTA: { ...STATION_POINTS.PTA, chainage: 0 },
  DBN: { ...STATION_POINTS.DBN, chainage: Math.round(CORRIDOR_LENGTH_M * 10) / 10 }
};

const GROUPS = GROUPS_CONFIG.map((g) => ({
  ...g,
  crossings: [...g.crossings].sort(
    (a, b) => CROSSINGS.find((c) => c.number === a).chainage - CROSSINGS.find((c) => c.number === b).chainage
  )
}));

function getCrossing(number) {
  return CROSSINGS.find((c) => c.number === Number(number)) || null;
}

/** Crossings in the order a train in `direction` meets them. */
function crossingOrder(direction) {
  const list = [...CROSSINGS];
  return direction === 'DHABLAN_TO_PATIALA' ? list.reverse() : list;
}

/** Signed along-track distance from a train to a target (positive = ahead). */
function distanceAhead(trainChainage, targetChainage, direction) {
  const sign = DIRECTIONS[direction] ? DIRECTIONS[direction].sign : 0;
  return (targetChainage - trainChainage) * sign;
}

/** Corridor entry/exit chainage for a direction. */
function corridorEnds(direction) {
  return direction === 'DHABLAN_TO_PATIALA'
    ? { entry: STATIONS.DBN.chainage, exit: STATIONS.PTA.chainage }
    : { entry: STATIONS.PTA.chainage, exit: STATIONS.DBN.chainage };
}

/** Public geometry for the frontend map. */
function geometryForClient() {
  return {
    corridor: track.corridor,
    regional: REGIONAL_LINE,
    corridorLengthMeters: Math.round(CORRIDOR_LENGTH_M),
    source: track.source
  };
}

module.exports = {
  DIRECTIONS,
  CROSSINGS,
  GROUPS,
  STATIONS,
  CORRIDOR_LENGTH_M,
  REGIONAL_LINE,
  chainageOf,
  pointAtChainage,
  headingAtChainage,
  getCrossing,
  crossingOrder,
  distanceAhead,
  corridorEnds,
  geometryForClient
};
