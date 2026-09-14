/**
 * Distance and Geodetic Calculation Module
 * Provides Haversine and polyline distance algorithms.
 * All coordinates in [longitude, latitude] GeoJSON format.
 */

const EARTH_RADIUS_METERS = 6371000; // Earth mean radius in meters

/**
 * Calculates Haversine great-circle distance between two [lon, lat] coordinates in meters.
 * @param {[number, number]} coord1 [lon1, lat1]
 * @param {[number, number]} coord2 [lon2, lat2]
 * @returns {number} Distance in meters
 */
function haversineDistance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10; // Round to 0.1m
}

/**
 * Calculates initial bearing from coord1 to coord2 in degrees (0 - 360).
 * @param {[number, number]} coord1 [lon1, lat1]
 * @param {[number, number]} coord2 [lon2, lat2]
 * @returns {number} Bearing in degrees
 */
function calculateBearing(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/**
 * Calculates the total length of a polyline in meters.
 * @param {Array<[number, number]>} polyline Array of [lon, lat]
 * @returns {number} Total distance in meters
 */
function calculatePolylineLength(polyline) {
  if (!Array.isArray(polyline) || polyline.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    total += haversineDistance(polyline[i], polyline[i + 1]);
  }
  return Math.round(total * 10) / 10;
}

module.exports = {
  haversineDistance,
  calculateBearing,
  calculatePolylineLength
};
