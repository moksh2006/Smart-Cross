/**
 * Coordinate and Distance Verification Script
 * Validates the DMS coordinates supplied by the project owner for Phataks 19, 20, 23, 24,
 * converts them to GeoJSON [longitude, latitude] decimal degrees,
 * and prints the calculated distances between each pair.
 */

const { dmsToGeoJsonPoint } = require('../server/src/services/gis/coordinateConverter');
const { haversineDistance } = require('../server/src/services/gis/distanceCalculator');

const SUPPLIED_COORDINATES = [
  {
    number: 24,
    name: 'Phatak 24 (Dhablan Approach)',
    latDms: `30°20'23.9"N`,
    lonDms: `76°21'24.4"E`
  },
  {
    number: 23,
    name: 'Phatak 23 (Model Town Extension)',
    latDms: `30°20'24.8"N`,
    lonDms: `76°21'59.7"E`
  },
  {
    number: 20,
    name: 'Phatak 20 (Sirhind Road)',
    latDms: `30°20'22.8"N`,
    lonDms: `76°23'33.3"E`
  },
  {
    number: 19,
    name: 'Phatak 19 (Patiala Station Approach)',
    latDms: `30°20'22.5"N`,
    lonDms: `76°23'54.3"E`
  }
];

function runVerification() {
  console.log('================================================================');
  console.log('SMARTCROSS — PATIALA PHATAK COORDINATE VERIFICATION REPORT');
  console.log('================================================================\n');

  const convertedPhataks = [];

  for (const phatak of SUPPLIED_COORDINATES) {
    const geoJsonPoint = dmsToGeoJsonPoint(phatak.latDms, phatak.lonDms);
    const [lon, lat] = geoJsonPoint.coordinates;

    convertedPhataks.push({
      number: phatak.number,
      name: phatak.name,
      latDms: phatak.latDms,
      lonDms: phatak.lonDms,
      decimalLat: lat,
      decimalLon: lon,
      geoJson: geoJsonPoint
    });

    console.log(`[Phatak ${phatak.number}] ${phatak.name}`);
    console.log(`  Raw DMS:     ${phatak.latDms}, ${phatak.lonDms}`);
    console.log(`  Decimal DD:  Latitude: ${lat.toFixed(6)}°N, Longitude: ${lon.toFixed(6)}°E`);
    console.log(`  GeoJSON:     ${JSON.stringify(geoJsonPoint)}`);
    console.log(`  Note:        coordinates[0] = Longitude (${lon.toFixed(6)}), coordinates[1] = Latitude (${lat.toFixed(6)})\n`);
  }

  // Create lookup by number
  const byNumber = {};
  convertedPhataks.forEach(p => { byNumber[p.number] = p; });

  console.log('================================================================');
  console.log('CALCULATED ACTUAL GEOGRAPHIC DISTANCES (Haversine Formula)');
  console.log('================================================================\n');

  const dist19_20 = haversineDistance(byNumber[19].geoJson.coordinates, byNumber[20].geoJson.coordinates);
  const dist20_23 = haversineDistance(byNumber[20].geoJson.coordinates, byNumber[23].geoJson.coordinates);
  const dist23_24 = haversineDistance(byNumber[23].geoJson.coordinates, byNumber[24].geoJson.coordinates);
  const totalSpan = haversineDistance(byNumber[19].geoJson.coordinates, byNumber[24].geoJson.coordinates);

  console.log(`• Distance 19 ↔ 20: ${dist19_20} meters  (Owner estimated ~700m)`);
  console.log(`• Distance 20 ↔ 23: ${dist20_23} meters (Owner estimated ~3000m)`);
  console.log(`• Distance 23 ↔ 24: ${dist23_24} meters  (Owner estimated ~700m)`);
  console.log(`• Total Corridor Span (19 ↔ 24): ${totalSpan} meters (~${(totalSpan/1000).toFixed(2)} km)\n`);

  console.log('✅ Coordinates and Distance Verification Completed successfully.\n');

  return {
    convertedPhataks,
    distances: {
      '19-20': dist19_20,
      '20-23': dist20_23,
      '23-24': dist23_24,
      '19-24': totalSpan
    }
  };
}

if (require.main === module) {
  runVerification();
}

module.exports = { runVerification, SUPPLIED_COORDINATES };
