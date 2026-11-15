/**
 * Converts a normalized live observation into a corridor chainage.
 *
 * Methods (in order):
 *  1. GPS   — validated lat/lng projected on the railway (only if within tolerance).
 *  2. ROUTE_DISTANCE — distanceFromOriginKm mapped linearly between the train's
 *     own route kilometre posts for PTA and DBN (scaled to the OSM track length,
 *     so the train reaches DBN exactly at the DBN chainage).
 *  3. STATION — train reported "at-station" at PTA or DBN.
 *  Otherwise NONE (no position is fabricated).
 */
const { chainageOf, STATIONS, CORRIDOR_LENGTH_M } = require('../../config/corridor');

const GPS_TOLERANCE_M = 300;
const MIN_CORRIDOR_KM = 8;   // plausibility bounds for |km(DBN) - km(PTA)|
const MAX_CORRIDOR_KM = 20;

/**
 * @param {object} obs normalized live status (trainDataNormalizer.normalizeLiveStatus)
 * @param {{ ptaKm?: number|null, dbnKm?: number|null }} kmPosts fallback kilometre posts (timetable)
 * @returns {{ chainage: number|null, method: string, offTrackMeters?: number, issues: string[] }}
 */
function resolveChainage(obs, kmPosts = {}) {
  const issues = [];
  if (obs.gps) {
    const c = chainageOf([obs.gps.lng, obs.gps.lat]);
    if (c.offTrackMeters <= GPS_TOLERANCE_M) {
      return { chainage: c.chainage, method: 'GPS', offTrackMeters: c.offTrackMeters, issues };
    }
    issues.push(`GPS_OFF_TRACK_${Math.round(c.offTrackMeters)}M`);
  }

  const routePta = obs.route && obs.route.find((r) => r.stationCode === 'PTA');
  const routeDbn = obs.route && obs.route.find((r) => r.stationCode === 'DBN');
  const ptaKm = routePta && routePta.distanceKm !== null ? routePta.distanceKm : kmPosts.ptaKm;
  const dbnKm = routeDbn && routeDbn.distanceKm !== null ? routeDbn.distanceKm : kmPosts.dbnKm;

  if (obs.distanceFromOriginKm !== null && obs.distanceFromOriginKm !== undefined &&
      Number.isFinite(ptaKm) && Number.isFinite(dbnKm)) {
    const span = dbnKm - ptaKm;
    if (Math.abs(span) >= MIN_CORRIDOR_KM && Math.abs(span) <= MAX_CORRIDOR_KM) {
      const chainage = CORRIDOR_LENGTH_M * ((obs.distanceFromOriginKm - ptaKm) / span);
      return { chainage: Math.round(chainage * 10) / 10, method: 'ROUTE_DISTANCE', issues };
    }
    issues.push('IMPLAUSIBLE_KM_POSTS');
  }

  if (obs.atStation && (obs.currentStationCode === 'PTA' || obs.currentStationCode === 'DBN')) {
    return { chainage: STATIONS[obs.currentStationCode].chainage, method: 'STATION', issues };
  }

  return { chainage: null, method: 'NONE', issues };
}

module.exports = { resolveChainage, GPS_TOLERANCE_M };
