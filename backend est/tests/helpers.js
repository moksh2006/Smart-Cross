const env = require('../src/config/env');

const thresholds = (over = {}) => ({ ...env.THRESHOLD_DEFAULTS, ...over });

/** Controllable clock for deterministic tests. */
function fakeClock(start = new Date('2026-11-12T05:00:00Z')) {
  let now = new Date(start);
  const clock = () => new Date(now);
  clock.advance = (ms) => { now = new Date(now.getTime() + ms); return clock(); };
  clock.set = (d) => { now = new Date(d); };
  return clock;
}

function trainState(over = {}) {
  return {
    trainNumber: 'T1',
    trainName: 'Test train',
    mode: 'SIMULATION',
    direction: 'PATIALA_TO_DHABLAN',
    lastObservation: null,
    recentSpeeds: [],
    historicalSpeedKmh: null,
    timing: null,
    knownDelay: null,
    historical: {},
    ...over
  };
}

function obs(over = {}) {
  return {
    chainage: -2000,
    speedKmh: 60,
    observedAt: new Date(),
    delayMinutes: 0,
    atStation: false,
    currentStationCode: '',
    positionMethod: 'ROUTE_DISTANCE',
    dataSource: 'SIMULATION',
    ...over
  };
}

module.exports = { thresholds, fakeClock, trainState, obs };
