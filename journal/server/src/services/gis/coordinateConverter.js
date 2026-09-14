/**
 * Coordinate Converter Module for SmartCross
 * Converts Degree-Minute-Second (DMS) coordinates to Decimal Degrees (DD)
 * and formats as GeoJSON Point [longitude, latitude].
 */

/**
 * Parses DMS string like 30°20'23.9"N or 76°21'24.4"E into decimal degrees.
 * @param {string} dmsStr
 * @returns {number} Decimal degrees
 */
function dmsToDecimal(dmsStr) {
  if (typeof dmsStr !== 'string') {
    throw new Error(`Invalid DMS input: expected string, got ${typeof dmsStr}`);
  }

  const cleaned = dmsStr.trim();
  // Regex to capture degrees, minutes, seconds, and direction (N/S/E/W)
  const regex = /^\s*(\d+)°\s*(\d+)'\s*([\d.]+)"?\s*([NSEWnsew])\s*$/;
  const match = cleaned.match(regex);

  if (!match) {
    throw new Error(`Failed to parse DMS format: "${dmsStr}". Expected format: 30°20'23.9"N`);
  }

  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  const direction = match[4].toUpperCase();

  let dd = degrees + (minutes / 60) + (seconds / 3600);

  // South and West are negative
  if (direction === 'S' || direction === 'W') {
    dd = -dd;
  }

  // Round to 6 decimal places for GIS standard (~0.1m precision)
  return Math.round(dd * 1000000) / 1000000;
}

/**
 * Converts DMS latitude and longitude into GeoJSON Point.
 * IMPORTANT: GeoJSON standard is [longitude, latitude].
 * @param {string} latDms E.g. "30°20'23.9\"N"
 * @param {string} lonDms E.g. "76°21'24.4\"E"
 * @returns {{ type: 'Point', coordinates: [number, number] }}
 */
function dmsToGeoJsonPoint(latDms, lonDms) {
  const latitude = dmsToDecimal(latDms);
  const longitude = dmsToDecimal(lonDms);

  return {
    type: 'Point',
    coordinates: [longitude, latitude] // [lon, lat] - NEVER REVERSE!
  };
}

module.exports = {
  dmsToDecimal,
  dmsToGeoJsonPoint
};
