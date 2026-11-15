#!/usr/bin/env node
/**
 * Prints the GIS verification report: each configured crossing's DMS vs decimal
 * coordinates, distance from the OSM railway line, chainage from Patiala station
 * and along-track spacing.  Usage: npm run verify-coords
 */
const corridor = require('../src/config/corridor');
const { dmsToDecimal } = require('../src/services/gis/coordinateConverter');

console.log('SmartCross crossing verification (geometry: %s)\n', corridor.geometryForClient().source);
console.log('Corridor length PTA -> DBN along track: %d m\n', Math.round(corridor.CORRIDOR_LENGTH_M));
let prev = { name: 'PTA', chainage: 0 };
for (const c of corridor.crossingOrder('PATIALA_TO_DHABLAN')) {
  const dLat = Math.abs(dmsToDecimal(c.dms.lat) - c.lat) * 111320;
  const dLon = Math.abs(dmsToDecimal(c.dms.lon) - c.lon) * 111320 * Math.cos(c.lat * Math.PI / 180);
  console.log(`Phatak ${c.number} ${c.name.padEnd(22)} ${c.lat.toFixed(6)}, ${c.lon.toFixed(6)} | DMS diff ${Math.hypot(dLat, dLon).toFixed(1)} m | off-track ${c.offTrackMeters} m | chainage ${c.chainage} m | +${Math.round(c.chainage - prev.chainage)} m from ${prev.name}`);
  prev = { name: `Phatak ${c.number}`, chainage: c.chainage };
}
console.log(`DBN at ${corridor.STATIONS.DBN.chainage} m (+${Math.round(corridor.STATIONS.DBN.chainage - prev.chainage)} m from ${prev.name})`);
const bad = corridor.CROSSINGS.filter((c) => c.offTrackMeters > 25);
if (bad.length) { console.error(`\nWARNING: crossings far from track: ${bad.map((c) => c.number).join(', ')}`); process.exit(1); }
console.log('\nAll crossings lie on the OSM railway line (< 25 m).');
