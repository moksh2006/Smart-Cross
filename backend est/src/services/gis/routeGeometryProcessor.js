/**
 * Railway polyline geometry helpers.
 * All coordinates are GeoJSON order [longitude, latitude].
 *
 * Projection uses a local equirectangular approximation (longitude scaled by
 * cos(latitude)), which is accurate to well under a metre over segments of a
 * few kilometres at Patiala's latitude, and exact distances use Haversine.
 */
const { haversineDistance } = require('./distanceCalculator');

const DEG = Math.PI / 180;

/**
 * Projects point p onto segment [a, b].
 * @returns {{ point: [number, number], t: number }} t in [0, 1]
 */
function projectPointOnSegment(p, a, b) {
  const k = Math.cos(((a[1] + b[1]) / 2) * DEG);
  const ax = a[0] * k; const ay = a[1];
  const bx = b[0] * k; const by = b[1];
  const px = p[0] * k; const py = p[1];
  const dx = bx - ax; const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { point: [a[0], a[1]], t: 0 };
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], t };
}

/** Cumulative distance (metres) at every vertex of a polyline. */
function cumulativeDistances(polyline) {
  const cum = [0];
  for (let i = 1; i < polyline.length; i++) {
    cum.push(cum[i - 1] + haversineDistance(polyline[i - 1], polyline[i]));
  }
  return cum;
}

/**
 * Projects a point on to a polyline.
 * @param {[number, number]} point
 * @param {Array<[number, number]>} polyline
 * @param {number[]} [cum] precomputed cumulative distances
 * @returns {{ nearestPoint: [number, number], distanceFromTrackMeters: number, distanceAlongRouteMeters: number, segmentIndex: number }}
 */
function projectPointOnTrack(point, polyline, cum = null) {
  if (!Array.isArray(polyline) || polyline.length < 2) {
    throw new Error('Polyline must have at least 2 points');
  }
  if (!isValidCoordinate(point)) throw new Error('Invalid coordinate');
  const c = cum || cumulativeDistances(polyline);
  let best = { d: Infinity, i: 0, pt: polyline[0] };
  for (let i = 0; i < polyline.length - 1; i++) {
    const { point: pr } = projectPointOnSegment(point, polyline[i], polyline[i + 1]);
    const d = haversineDistance(point, pr);
    if (d < best.d) best = { d, i, pt: pr };
  }
  const along = c[best.i] + haversineDistance(polyline[best.i], best.pt);
  return {
    nearestPoint: [round6(best.pt[0]), round6(best.pt[1])],
    distanceFromTrackMeters: Math.round(best.d * 10) / 10,
    distanceAlongRouteMeters: Math.round(along * 10) / 10,
    segmentIndex: best.i
  };
}

/** Returns the [lon, lat] located `distance` metres along the polyline (clamped). */
function pointAtDistance(polyline, distance, cum = null) {
  const c = cum || cumulativeDistances(polyline);
  const total = c[c.length - 1];
  const d = Math.max(0, Math.min(total, distance));
  let i = 1;
  while (i < c.length - 1 && c[i] < d) i++;
  const segLen = c[i] - c[i - 1];
  const t = segLen > 0 ? (d - c[i - 1]) / segLen : 0;
  const a = polyline[i - 1]; const b = polyline[i];
  return [round6(a[0] + (b[0] - a[0]) * t), round6(a[1] + (b[1] - a[1]) * t)];
}

/** Bearing (degrees from north) of the polyline at the given distance. */
function bearingAtDistance(polyline, distance, cum = null) {
  const c = cum || cumulativeDistances(polyline);
  const d = Math.max(0, Math.min(c[c.length - 1], distance));
  let i = 1;
  while (i < c.length - 1 && c[i] < d) i++;
  const a = polyline[i - 1]; const b = polyline[i];
  const y = Math.sin((b[0] - a[0]) * DEG) * Math.cos(b[1] * DEG);
  const x = Math.cos(a[1] * DEG) * Math.sin(b[1] * DEG) -
    Math.sin(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.cos((b[0] - a[0]) * DEG);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

function isValidCoordinate(c) {
  return Array.isArray(c) && c.length >= 2 &&
    Number.isFinite(c[0]) && Number.isFinite(c[1]) &&
    c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90;
}

function round6(v) { return Math.round(v * 1e6) / 1e6; }

module.exports = {
  projectPointOnSegment,
  projectPointOnTrack,
  cumulativeDistances,
  pointAtDistance,
  bearingAtDistance,
  isValidCoordinate
};
