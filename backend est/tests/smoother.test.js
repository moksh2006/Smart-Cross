const { PredictionSmoother } = require('../src/services/prediction/predictionSmoother');

const at = (s) => new Date(Date.UTC(2026, 10, 12, 5, 0, s));
const base = { mode: 'LIVE', trainNumber: '1', phatakNumber: 19, source: 'LIVE_POSITION' };

describe('prediction smoothing', () => {
  test('first value passes through; small changes are blended', () => {
    const s = new PredictionSmoother();
    expect(s.smooth({ ...base, rawEtaSeconds: 600, now: at(0) }).etaSeconds).toBe(600);
    const r = s.smooth({ ...base, rawEtaSeconds: 620, now: at(10) }); // expected 590, delta 30
    expect(r.etaSeconds).toBe(602);
    expect(r.outlier).toBe(false);
  });
  test('single large jump is treated as an outlier, persistent jump is accepted', () => {
    const s = new PredictionSmoother();
    s.smooth({ ...base, rawEtaSeconds: 600, now: at(0) });
    const o = s.smooth({ ...base, rawEtaSeconds: 1200, now: at(10) });
    expect(o.outlier).toBe(true);
    expect(o.etaSeconds).toBeLessThan(700);
    const accepted = s.smooth({ ...base, rawEtaSeconds: 1190, now: at(20) });
    expect(accepted.etaSeconds).toBe(1190);
  });
  test('source change or long gap resets the baseline', () => {
    const s = new PredictionSmoother();
    s.smooth({ ...base, rawEtaSeconds: 600, now: at(0) });
    expect(s.smooth({ ...base, source: 'TIMETABLE_ESTIMATE', rawEtaSeconds: 900, now: at(5) }).etaSeconds).toBe(900);
    expect(s.smooth({ ...base, source: 'TIMETABLE_ESTIMATE', rawEtaSeconds: 100, now: new Date(at(5).getTime() + 400000) }).etaSeconds).toBe(100);
  });
  test('near arrival never lags behind the raw estimate; zero clears state', () => {
    const s = new PredictionSmoother();
    s.smooth({ ...base, rawEtaSeconds: 100, now: at(0) });
    expect(s.smooth({ ...base, rawEtaSeconds: 30, now: at(5) }).etaSeconds).toBeLessThanOrEqual(30);
    expect(s.smooth({ ...base, rawEtaSeconds: 0, now: at(6) }).etaSeconds).toBe(0);
  });
});
