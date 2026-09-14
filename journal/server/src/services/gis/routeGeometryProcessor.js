/**
 * Railway Track Route Geometry Processing Module
 * Handles track polyline projection, nearest-point-on-line snapping,
 * along-track distance calculation, and corridor evaluation.
 */

const { haversineDistance } = require('./distanceCalculator');

/**
 * Authoritative Northern Railway track coordinates between Patiala (PTA) and Dhablan (DBN)
 * Coordinates in [longitude, latitude] GeoJSON format.
 * Direction: East (PTA) to West (DBN)
 */
const PTA_TO_DBN_CORRIDOR_TRACK = [
  [76.410200, 30.338500], // Patiala Junction Station (PTA)
  [76.405000, 30.339000], // PTA West Yard
  [76.398417, 30.339583], // Phatak 19
  [76.392583, 30.339667], // Phatak 20
  [76.385000, 30.339800], // Intermediate track section
  [76.375000, 30.340000], // Intermediate track section
  [76.366583, 30.340222], // Phatak 23
  [76.356778, 30.339972], // Phatak 24
  [76.335000, 30.339200], // Rural stretch toward Dhablan
  [76.315000, 30.338500], // Outer approach
  [76.304500, 30.338000]  // Dhablan Station (DBN)
];

/**
 * Gets the default authoritative track geometry.
 * @param {'PATIALA_TO_DHABLAN' | 'DHABLAN_TO_PATIALA'} direction
 * @returns {Array<[number, number]>}
 */
function getTrackGeometry(direction = 'PATIALA_TO_DHABLAN') {
  if (direction === 'DHABLAN_TO_PATIALA') {
    return [...PTA_TO_DBN_CORRIDOR_TRACK].reverse();
  }
  return [...PTA_TO_DBN_CORRIDOR_TRACK];
}

/**
 * Finds the nearest point on a line segment [p1, p2] to a given point p.
 * Projects point onto the segment and clamps to endpoints.
 * @param {[number, number]} p [lon, lat]
 * @param {[number, number]} p1 [lon, lat]
 * @param {[number, number]} p2 [lon, lat]
 * @returns {{ point: [number, number], t: number }}
 */
function projectPointOnSegment(p, p1, p2) {
  const [x, y] = p;
  const [x1, y1] = p1;
  const [x2, y2] = p2;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return { point: [x1, y1], t: 0 };
  }

  // Parameter t of projection onto line
  let t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t)); // clamp to segment

  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;

  return { point: [nearestX, nearestY], t };
}

/**
 * Projects a point onto a track polyline and returns the nearest route point,
 * the perpendicular distance from the track in meters, and the distance along the track from the start.
 * @param {[number, number]} point [lon, lat]
 * @param {Array<[number, number]>} polyline Array of [lon, lat]
 * @returns {{
 *   nearestPoint: [number, number],
 *   distanceFromTrackMeters: number,
 *   distanceAlongRouteMeters: number,
 *   segmentIndex: number
 * }}
 */
function projectPointOnTrack(point, polyline = PTA_TO_DBN_CORRIDOR_TRACK) {
  if (!polyline || polyline.length < 2) {
    throw new Error('Polyline must have at least 2 points');
  }

  let minDistance = Infinity;
  let bestNearestPoint = polyline[0];
  let bestSegmentIndex = 0;
  let bestSegmentT = 0;

  // Find the closest segment
  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];

    const { point: projPoint, t } = projectPointOnSegment(point, p1, p2);
    const dist = haversineDistance(point, projPoint);

    if (dist < minDistance) {
      minDistance = dist;
      bestNearestPoint = projPoint;
      bestSegmentIndex = i;
      bestSegmentT = t;
    }
  }

  // Calculate distance along the route from polyline[0] to bestNearestPoint
  let distanceAlongRoute = 0;
  for (let i = 0; i < bestSegmentIndex; i++) {
    distanceAlongRoute += haversineDistance(polyline[i], polyline[i + 1]);
  }
  distanceAlongRoute += haversineDistance(polyline[bestSegmentIndex], bestNearestPoint);

  return {
    nearestPoint: [
      Math.round(bestNearestPoint[0] * 1000000) / 1000000,
      Math.round(bestNearestPoint[1] * 1000000) / 1000000
    ],
    distanceFromTrackMeters: Math.round(minDistance * 10) / 10,
    distanceAlongRouteMeters: Math.round(distanceAlongRoute * 10) / 10,
    segmentIndex: bestSegmentIndex
  };
}

/**
 * Calculates the along-track distance in meters between two points on the track polyline.
 * @param {[number, number]} pointA [lon, lat]
 * @param {[number, number]} pointB [lon, lat]
 * @param {Array<[number, number]>} polyline
 * @returns {number} Signed distance (positive if pointB is downstream along polyline from pointA)
 */
function getAlongTrackDistance(pointA, pointB, polyline = PTA_TO_DBN_CORRIDOR_TRACK) {
  const projA = projectPointOnTrack(pointA, polyline);
  const projB = projectPointOnTrack(pointB, polyline);
  return Math.round((projB.distanceAlongRouteMeters - projA.distanceAlongRouteMeters) * 10) / 10;
}

module.exports = {
  PTA_TO_DBN_CORRIDOR_TRACK,
  getTrackGeometry,
  projectPointOnSegment,
  projectPointOnTrack,
  getAlongTrackDistance
};
