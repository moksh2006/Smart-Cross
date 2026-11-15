/**
 * Mock RailRadar provider for SIMULATION mode.
 *
 * Produces responses in the documented GET /v1/trains/{n}/live format from the
 * simulation engine's kinematic state so that simulated trains travel through
 * the exact same normalizer -> position resolver -> prediction engine path as
 * live data. Every payload is marked `"source": "simulation"` in meta and the
 * resulting observations carry dataSource = 'SIMULATION'. It is never used in
 * LIVE mode.
 */
const { STATIONS, CORRIDOR_LENGTH_M } = require('../../config/corridor');

const ORIGIN_OFFSET_KM = 20; // virtual origin 20 km before the corridor entry station

/** Route kilometre posts for a simulated train in the given direction. */
function kmPosts(direction) {
  const lenKm = CORRIDOR_LENGTH_M / 1000;
  return direction === 'DHABLAN_TO_PATIALA'
    ? { dbnKm: ORIGIN_OFFSET_KM, ptaKm: ORIGIN_OFFSET_KM + lenKm }
    : { ptaKm: ORIGIN_OFFSET_KM, dbnKm: ORIGIN_OFFSET_KM + lenKm };
}

function chainageToKm(chainage, direction) {
  const { ptaKm, dbnKm } = kmPosts(direction);
  return ptaKm + (chainage / CORRIDOR_LENGTH_M) * (dbnKm - ptaKm);
}

/**
 * @param {object} sim simulated train state from simulationEngine
 * @param {Date} now
 */
function buildLivePayload(sim, now) {
  const posts = kmPosts(sim.direction);
  const atPta = Math.abs(sim.chainage - STATIONS.PTA.chainage) < 150 && sim.speedKmh < 1;
  const atDbn = Math.abs(sim.chainage - STATIONS.DBN.chainage) < 150 && sim.speedKmh < 1;
  const route = [
    { sequence: 1, stationCode: 'SIMO', stationName: 'Simulation origin', isHalt: true, distance: 0 },
    { sequence: 2, stationCode: 'PTA', stationName: 'Patiala', isHalt: true, distance: Math.round(posts.ptaKm * 1000) / 1000 },
    { sequence: 3, stationCode: 'DBN', stationName: 'Dhablan', isHalt: true, distance: Math.round(posts.dbnKm * 1000) / 1000 }
  ];
  if (sim.direction === 'DHABLAN_TO_PATIALA') route.splice(1, 2, route[2], route[1]);
  const observedAt = sim.signalLost && sim.lastSignalAt ? sim.lastSignalAt : now;
  return {
    success: true,
    data: {
      trainNumber: sim.trainNumber,
      trainName: sim.trainName,
      startDate: now.toISOString().slice(0, 10),
      lastUpdatedAt: observedAt.toISOString(),
      status: sim.finished ? 'completed' : 'running',
      isLive: true,
      trackingMode: 'simulation',
      delayMinutes: sim.delayMinutes,
      currentLocation: {
        stationCode: atPta ? 'PTA' : atDbn ? 'DBN' : '',
        stationName: atPta ? 'Patiala' : atDbn ? 'Dhablan' : '',
        status: atPta || atDbn ? 'at-station' : 'running',
        isHalt: atPta || atDbn,
        distanceFromOriginKm: Math.round(chainageToKm(sim.signalLost ? sim.lastSignalChainage : sim.chainage, sim.direction) * 1000) / 1000,
        speedKmh: Math.round((sim.signalLost ? sim.lastSignalSpeed : sim.speedKmh) * 10) / 10,
        delayMinutes: sim.delayMinutes
      },
      route
    },
    meta: { source: 'simulation', timestamp: now.toISOString() }
  };
}

module.exports = { buildLivePayload, kmPosts, chainageToKm, ORIGIN_OFFSET_KM };
