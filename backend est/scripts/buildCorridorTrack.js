#!/usr/bin/env node
/**
 * Builds backend/src/data/corridorTrack.json from the raw OpenStreetMap export
 * in backend/data/osm_track.json (Overpass query: way["railway"="rail"]
 * inside bbox 30.33,76.27,30.35,76.42 — see fetchOsmTrack.js).
 *
 * The OSM export contains several disconnected ways. This script stitches them
 * into one ordered polyline running from Patiala station (PTA) westwards to
 * Dhablan station (DBN), plus the short OSM stretch east/north of PTA.
 *
 * Usage: node scripts/buildCorridorTrack.js
 */
const fs = require('fs');
const path = require('path');
const { haversineDistance } = require('../src/services/gis/distanceCalculator');

const RAW = path.join(__dirname, '../data/osm_track.json');
const OUT = path.join(__dirname, '../src/data/corridorTrack.json');

// Reference station points (lon, lat). PTA coincides exactly with an OSM node.
// DBN is snapped to the nearest point on the OSM line (see README "Known limitations").
const PTA = [76.4017301, 30.3420719];
const DBN_APPROX = [76.27859, 30.337749];

function main() {
  const ways = JSON.parse(fs.readFileSync(RAW, 'utf8')).map((w) => w.map((p) => [p.lon, p.lat]));

  const nearestIdx = (line, pt) => {
    let best = 0;
    let bestD = Infinity;
    line.forEach((p, i) => {
      const d = haversineDistance(p, pt);
      if (d < bestD) { bestD = d; best = i; }
    });
    return { idx: best, dist: bestD };
  };

  // Way 0 runs from the NE (towards Rajpura) through PTA and westwards to ~76.3496.
  const w0 = ways[0];
  const ptaHit = nearestIdx(w0, PTA);
  if (ptaHit.dist > 5) throw new Error(`PTA not on way 0 (${ptaHit.dist} m)`);

  // Chain: way0[PTA..end] -> way5 -> way3 -> way4 -> way1 (west to 76.21)
  const chain = [w0.slice(ptaHit.idx), ways[5], ways[3], ways[4], ways[1]];
  const stitched = [];
  for (const seg of chain) {
    const joint = stitched[stitched.length - 1];
    if (joint && haversineDistance(joint, seg[0]) > 5) throw new Error('Gap between OSM ways while stitching');
    for (const p of seg) {
      const last = stitched[stitched.length - 1];
      if (last && haversineDistance(last, p) < 0.5) continue; // drop duplicate joints
      stitched.push(p);
    }
  }

  // Trim at DBN
  const dbnHit = nearestIdx(stitched, DBN_APPROX);
  const corridor = stitched.slice(0, dbnHit.idx + 1);
  const westBeyondDbn = stitched.slice(dbnHit.idx);

  // East of PTA (reverse so it starts at PTA and moves away)
  const eastOfPta = w0.slice(0, ptaHit.idx + 1).reverse();

  let length = 0;
  for (let i = 1; i < corridor.length; i++) length += haversineDistance(corridor[i - 1], corridor[i]);

  const out = {
    source: 'OpenStreetMap contributors (ODbL) via Overpass API, way["railway"="rail"] bbox 30.33,76.27,30.35,76.42',
    generatedBy: 'backend/scripts/buildCorridorTrack.js',
    note: 'Coordinates are [lon, lat]. corridor runs PTA -> DBN. eastOfPta runs PTA -> north-east. westBeyondDbn runs DBN -> west.',
    corridorLengthMeters: Math.round(length),
    corridor,
    eastOfPta,
    westBeyondDbn
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`Corridor: ${corridor.length} points, ${Math.round(length)} m; DBN snapped ${dbnHit.dist.toFixed(1)} m from approx point`);
  console.log(`East of PTA: ${eastOfPta.length} points; West beyond DBN: ${westBeyondDbn.length} points`);
  console.log(`Written ${OUT}`);
}

main();
