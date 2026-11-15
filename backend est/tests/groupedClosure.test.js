const { thresholds } = require('./helpers');
const { trainImpact } = require('../src/services/gate/gateStateMachine');
const { detectGroupedClosures } = require('../src/services/gate/groupedClosureDetector');

const t = thresholds();
const now = new Date('2026-11-12T05:00:00Z');
const plus = (s) => new Date(now.getTime() + s * 1000);
const p = (num, eta, over = {}) => ({
  trainNumber: 'X1', trainName: 'Test', direction: 'DHABLAN_TO_PATIALA', mode: 'SIMULATION', phatakNumber: num,
  positional: true, status: 'APPROACHING', distanceMeters: eta * 12, etaSeconds: eta, source: 'LIVE_POSITION', confidence: 'HIGH',
  predictedArrival: plus(eta), predictedClosureStart: plus(eta - 150), predictedReopen: plus(eta + 80), closureDurationSeconds: 230, ...over
});
const map = (preds) => {
  const m = new Map([[19, []], [20, []], [23, []], [24, []]]);
  for (const x of preds) m.get(x.phatakNumber).push({ prediction: x, impact: trainImpact(x, t) });
  return m;
};

describe('grouped closure detection', () => {
  test('one train affecting 24 and 23 -> Group B advisory with sequence 24 -> 23', () => {
    const adv = detectGroupedClosures(map([p(24, 120), p(23, 200)]), t);
    expect(adv).toHaveLength(1);
    expect(adv[0]).toMatchObject({ groupId: 'B', trainNumber: 'X1', sequence: [24, 23], confidence: 'HIGH' });
    expect(adv[0].crossings[0].predictedClosureStart).toBeInstanceOf(Date);
    expect(adv[0].windowEnd > adv[0].windowStart).toBe(true);
    expect(adv[0].message).toMatch(/actual barrier timings may differ/);
  });
  test('does not claim simultaneous closure; reports overlap flag', () => {
    const far = detectGroupedClosures(map([p(24, 120), p(23, 900, { predictedClosureStart: plus(750), predictedReopen: plus(980) })]), t);
    expect(far).toHaveLength(1);
    expect(far[0].predictedWindowsOverlap).toBe(false);
  });
  test('no advisory when only one crossing of a group is affected or nothing imminent', () => {
    expect(detectGroupedClosures(map([p(24, 120)]), t)).toHaveLength(0);
    expect(detectGroupedClosures(map([p(24, 1500), p(23, 1600)]), t)).toHaveLength(0);
  });
  test('confidence is the minimum across crossings', () => {
    const adv = detectGroupedClosures(map([p(20, 100), p(19, 150, { confidence: 'MEDIUM' })]), t);
    expect(adv[0]).toMatchObject({ groupId: 'A', confidence: 'MEDIUM' });
  });
  test('two trains produce separate advisories', () => {
    const adv = detectGroupedClosures(map([p(24, 100), p(23, 150), p(24, 300, { trainNumber: 'X2' }), p(23, 360, { trainNumber: 'X2' })]), t);
    expect(adv.map((a) => a.trainNumber).sort()).toEqual(['X1', 'X2']);
  });
});
