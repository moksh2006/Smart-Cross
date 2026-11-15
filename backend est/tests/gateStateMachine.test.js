const { thresholds } = require('./helpers');
const { trainImpact, aggregateCrossing, GateStateMachine, isImmediate } = require('../src/services/gate/gateStateMachine');

const t = thresholds();
const now = new Date('2026-11-12T05:00:00Z');
const plus = (s) => new Date(now.getTime() + s * 1000);

const pos = (over = {}) => ({
  trainNumber: 'A', positional: true, status: 'APPROACHING', distanceMeters: 5000, etaSeconds: 400,
  source: 'LIVE_POSITION', confidence: 'HIGH', stoppedNow: false,
  predictedArrival: plus(400), predictedClosureStart: plus(250), predictedReopen: plus(480), ...over
});
const tt = (over = {}) => ({ ...pos(over), positional: false, distanceMeters: null, source: 'TIMETABLE_ESTIMATE', confidence: 'LOW', ...over });
const item = (p) => ({ prediction: p, impact: trainImpact(p, t) });

describe('train impact thresholds (configurable)', () => {
  test('OPEN beyond 10 min, CLOSING_SOON within 10 min', () => {
    expect(trainImpact(pos({ etaSeconds: 11 * 60, distanceMeters: 9000 }), t).state).toBe('OPEN');
    expect(trainImpact(pos({ etaSeconds: 9 * 60, distanceMeters: 7000 }), t).state).toBe('CLOSING_SOON');
  });
  test('CLOSED within 1200 m or ETA <= 2.5 min', () => {
    expect(trainImpact(pos({ distanceMeters: 1150, etaSeconds: 200 }), t).state).toBe('CLOSED');
    expect(trainImpact(pos({ distanceMeters: 2000, etaSeconds: 140 }), t).state).toBe('CLOSED');
  });
  test('stopped train within 1200 m uses ETA rule only', () => {
    expect(trainImpact(pos({ distanceMeters: 500, etaSeconds: 400, stoppedNow: true }), t).state).toBe('CLOSING_SOON');
  });
  test('passage: AT_CROSSING closed, PASSED opening soon, cleared open', () => {
    expect(trainImpact(pos({ status: 'AT_CROSSING' }), t).state).toBe('CLOSED');
    expect(trainImpact(pos({ status: 'PASSED', cleared: false }), t).state).toBe('OPENING_SOON');
    expect(trainImpact(pos({ status: 'PASSED', cleared: true }), t).state).toBe('OPEN');
  });
  test('timetable-only predictions never claim CLOSED', () => {
    expect(trainImpact(tt({ etaSeconds: 30 }), t).state).toBe('CLOSING_SOON');
    expect(trainImpact(tt({ status: 'DUE', etaSeconds: 0 }), t).state).toBe('CLOSING_SOON');
    expect(trainImpact(tt({ status: 'PASSED' }), t).state).toBe('OPEN');
  });
  test('thresholds are configurable', () => {
    expect(trainImpact(pos({ etaSeconds: 9 * 60 }), thresholds({ CLOSING_SOON_THRESHOLD_MINUTES: 5 })).state).toBe('OPEN');
  });
  test('unknown prediction -> UNKNOWN', () => {
    expect(trainImpact({ status: 'UNKNOWN', reason: 'x' }, t).state).toBe('UNKNOWN');
  });
});

describe('multiple trains at one crossing', () => {
  test('CLOSED wins over everything', () => {
    const a = aggregateCrossing([item(pos({ trainNumber: 'A', etaSeconds: 900, distanceMeters: 10000 })), item(pos({ trainNumber: 'B', distanceMeters: 800, etaSeconds: 60 }))], t);
    expect(a.state).toBe('CLOSED');
    expect(a.controlling.trainNumber).toBe('B');
  });
  test('one train passed but another approaching soon -> never OPEN', () => {
    const passed = pos({ trainNumber: 'A', status: 'PASSED', cleared: false, predictedReopen: plus(20) });
    const next = pos({ trainNumber: 'B', etaSeconds: 480, distanceMeters: 6000, predictedClosureStart: plus(330) });
    const a = aggregateCrossing([item(passed), item(next)], t);
    expect(a.state).toBe('OPENING_SOON');
    expect(a.reason).toMatch(/next: Train B/);
    const cleared = aggregateCrossing([item(pos({ trainNumber: 'A', status: 'PASSED', cleared: true })), item(next)], t);
    expect(cleared.state).toBe('CLOSING_SOON');
  });
  test('back-to-back: following train closes within gap -> stays CLOSED', () => {
    const passed = pos({ trainNumber: 'A', status: 'PASSED', cleared: false, predictedReopen: plus(30) });
    const next = pos({ trainNumber: 'B', etaSeconds: 200, distanceMeters: 2500, predictedClosureStart: plus(60) });
    const a = aggregateCrossing([item(passed), item(next)], t);
    expect(a.state).toBe('CLOSED');
    expect(a.controlling.trainNumber).toBe('B');
  });
  test('opposite-direction trains both counted', () => {
    const a = aggregateCrossing([item(pos({ trainNumber: 'A', direction: 'PATIALA_TO_DHABLAN', etaSeconds: 300, distanceMeters: 3000 })), item(pos({ trainNumber: 'B', direction: 'DHABLAN_TO_PATIALA', etaSeconds: 400, distanceMeters: 4000 }))], t);
    expect(a.state).toBe('CLOSING_SOON');
    expect(a.contributors).toHaveLength(2);
  });
  test('live position preferred over timetable when choosing controlling train', () => {
    const a = aggregateCrossing([item(tt({ trainNumber: 'T', etaSeconds: 100 })), item(pos({ trainNumber: 'L', etaSeconds: 300, distanceMeters: 4000 }))], t);
    expect(a.state).toBe('CLOSING_SOON');
    expect(a.controlling.trainNumber).toBe('L');
  });
  test('UNKNOWN only when no train gives a definite warning', () => {
    expect(aggregateCrossing([item({ status: 'UNKNOWN', reason: 'stale' })], t).state).toBe('UNKNOWN');
    expect(aggregateCrossing([item({ status: 'UNKNOWN', reason: 'stale' }), item(pos({ distanceMeters: 900, etaSeconds: 60 }))], t).state).toBe('CLOSED');
  });
});

describe('state machine transitions & hysteresis', () => {
  test('full cycle OPEN -> CLOSING_SOON -> CLOSED -> OPENING_SOON -> OPEN', () => {
    const m = new GateStateMachine();
    const seq = ['OPEN', 'CLOSING_SOON', 'CLOSED', 'OPENING_SOON', 'OPEN'];
    const transitions = seq.map((s, i) => m.apply(19, { state: s, reason: s, controlling: null }, plus(i * 10), t));
    expect(transitions.map((x) => x && x.newStatus)).toEqual(seq);
    expect(transitions[0].previousStatus).toBe('UNKNOWN');
  });
  test('duplicate states produce no transition', () => {
    const m = new GateStateMachine();
    m.apply(19, { state: 'CLOSED', reason: '' }, now, t);
    expect(m.apply(19, { state: 'CLOSED', reason: '' }, plus(5), t)).toBeNull();
  });
  test('downgrade CLOSING_SOON -> OPEN requires confirmation (anti-flap)', () => {
    const m = new GateStateMachine();
    m.apply(20, { state: 'CLOSING_SOON', reason: '' }, now, t);
    expect(m.apply(20, { state: 'OPEN', reason: '' }, plus(1), t)).toBeNull();
    expect(m.get(20).state).toBe('CLOSING_SOON');
    expect(m.apply(20, { state: 'CLOSING_SOON', reason: '' }, plus(5), t)).toBeNull(); // flap cancelled
    m.apply(20, { state: 'OPEN', reason: '' }, plus(6), t);
    const tr = m.apply(20, { state: 'OPEN', reason: '' }, plus(6 + t.DOWNGRADE_CONFIRM_SECONDS), t);
    expect(tr.newStatus).toBe('OPEN');
  });
  test('immediate rules', () => {
    expect(isImmediate('OPEN', 'CLOSED')).toBe(true);
    expect(isImmediate('CLOSED', 'OPENING_SOON')).toBe(true);
    expect(isImmediate('OPENING_SOON', 'OPEN')).toBe(true);
    expect(isImmediate('CLOSED', 'OPEN')).toBe(false);
    expect(isImmediate('CLOSED', 'UNKNOWN')).toBe(false);
    expect(isImmediate('UNKNOWN', 'OPEN')).toBe(true);
  });
});
