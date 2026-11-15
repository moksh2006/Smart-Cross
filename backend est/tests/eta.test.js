const { thresholds } = require('./helpers');
const { effectiveSpeed, closureWindow, positionalCrossingPrediction, timeBasedCrossingPrediction } = require('../src/services/prediction/etaCalculator');

const t = thresholds();
const now = new Date('2026-11-12T05:00:00Z');

describe('effective speed', () => {
  test('uses measured speed, blended with recent average', () => {
    expect(effectiveSpeed({ measuredKmh: 60 }, t)).toMatchObject({ speedKmh: 60, basis: 'MEASURED', stopped: false });
    expect(effectiveSpeed({ measuredKmh: 60, recentKmh: [40, 40] }, t).speedKmh).toBeCloseTo(54);
  });
  test('stopped train never yields zero speed (no division by zero)', () => {
    const s = effectiveSpeed({ measuredKmh: 0 }, t);
    expect(s.stopped).toBe(true);
    expect(s.speedKmh).toBeGreaterThanOrEqual(t.MIN_EFFECTIVE_SPEED_KMH);
  });
  test('unknown speed falls back to historical, then default', () => {
    expect(effectiveSpeed({ historicalKmh: 52 }, t)).toMatchObject({ speedKmh: 52, basis: 'HISTORICAL_AVERAGE' });
    expect(effectiveSpeed({}, t)).toMatchObject({ speedKmh: t.DEFAULT_CORRIDOR_SPEED_KMH, basis: 'DEFAULT_CORRIDOR_SPEED' });
  });
  test('unrealistic speeds are clamped', () => {
    expect(effectiveSpeed({ measuredKmh: 180 }, t).speedKmh).toBe(t.MAX_TRAIN_SPEED_KMH);
    expect(effectiveSpeed({ measuredKmh: 5 }, t).speedKmh).toBe(t.MIN_EFFECTIVE_SPEED_KMH);
  });
});

describe('ETA = distance / effective speed', () => {
  test('1200 m at 72 km/h = 60 s', () => {
    const p = positionalCrossingPrediction({ distanceAheadMeters: 1200, speed: { speedKmh: 72, stopped: false }, now }, t);
    expect(p.etaSeconds).toBe(60);
    expect(p.status).toBe('APPROACHING');
    expect(p.predictedArrival.getTime() - now.getTime()).toBe(60000);
  });
  test('dwell is added for a stopped train', () => {
    const p = positionalCrossingPrediction({ distanceAheadMeters: 1200, speed: { speedKmh: 72, stopped: true }, dwellSeconds: 120, now }, t);
    expect(p.etaSeconds).toBe(180);
  });
  test('train occupying and passed crossing', () => {
    const at = positionalCrossingPrediction({ distanceAheadMeters: -100, speed: { speedKmh: 36, stopped: false }, now }, t);
    expect(at.status).toBe('AT_CROSSING');
    const passed = positionalCrossingPrediction({ distanceAheadMeters: -(t.TRAIN_LENGTH_METERS + 50), speed: { speedKmh: 36, stopped: false }, now }, t);
    expect(passed.status).toBe('PASSED');
    expect(passed.cleared).toBe(false);
    const cleared = positionalCrossingPrediction({ distanceAheadMeters: -3000, speed: { speedKmh: 36, stopped: false }, now }, t);
    expect(cleared.cleared).toBe(true);
  });
  test('closure window: lead is max(distance threshold, ETA threshold)', () => {
    const arrival = new Date(now.getTime() + 600000);
    const w = closureWindow(arrival, 36, t); // 10 m/s -> 1200 m = 120 s < 150 s
    expect((arrival - w.closureStart) / 1000).toBe(150);
    const fast = closureWindow(arrival, 18, t); // 5 m/s -> 240 s
    expect((arrival - fast.closureStart) / 1000).toBe(240);
    expect(w.durationSeconds).toBeGreaterThan(150);
  });
  test('time-based prediction: DUE then PASSED after uncertainty window', () => {
    const due = timeBasedCrossingPrediction({ arrival: new Date(now.getTime() - 60000), now }, t);
    expect(due.status).toBe('DUE');
    const passed = timeBasedCrossingPrediction({ arrival: new Date(now.getTime() - (t.SCHEDULE_UNCERTAINTY_MINUTES + 1) * 60000), now }, t);
    expect(passed.status).toBe('PASSED');
  });
});
