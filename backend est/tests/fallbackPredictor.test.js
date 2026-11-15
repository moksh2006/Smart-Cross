const { thresholds, trainState, obs } = require('./helpers');
const { predictTrain } = require('../src/services/prediction/fallbackPredictor');
const corridor = require('../src/config/corridor');

const t = thresholds();
const now = new Date('2026-11-12T05:00:00Z');
const ago = (s) => new Date(now.getTime() - s * 1000);
const timing = (entryInMin, dir = 'PATIALA_TO_DHABLAN', transitMin = 15) => ({
  direction: dir,
  entryTime: new Date(now.getTime() + entryInMin * 60000),
  exitTime: new Date(now.getTime() + (entryInMin + transitMin) * 60000),
  ptaDeparture: dir === 'PATIALA_TO_DHABLAN' ? new Date(now.getTime() + entryInMin * 60000) : null,
  dbnDeparture: dir === 'DHABLAN_TO_PATIALA' ? new Date(now.getTime() + entryInMin * 60000) : null
});

describe('five-level fallback', () => {
  test('Level 1: fresh live position + speed -> LIVE_POSITION, HIGH', () => {
    const r = predictTrain(trainState({ lastObservation: obs({ observedAt: ago(20), chainage: -1000, speedKmh: 60 }) }), now, t);
    expect(r.source).toBe('LIVE_POSITION');
    expect(r.level).toBe(1);
    const p19 = r.predictions.find((p) => p.phatakNumber === 19);
    expect(p19.confidence).toBe('HIGH');
    expect(p19.status).toBe('APPROACHING');
    // dead-reckoned 20 s at 60 km/h ≈ 333 m
    expect(r.positionChainage).toBeGreaterThan(-700);
    expect(r.positionChainage).toBeLessThan(-600);
  });

  test('every prediction carries source, confidence, timestamp, ETA, train', () => {
    const r = predictTrain(trainState({ lastObservation: obs({ observedAt: ago(5) }) }), now, t);
    for (const p of r.predictions) {
      expect(p).toEqual(expect.objectContaining({
        source: expect.any(String), confidence: expect.any(String), calculatedAt: now,
        trainNumber: 'T1', phatakNumber: expect.any(Number)
      }));
      expect(p.predictedArrival).toBeInstanceOf(Date);
      expect(Number.isFinite(p.etaSeconds)).toBe(true);
    }
  });

  test('Level 2: stale observation -> dead reckoning, MEDIUM/LOW', () => {
    const r = predictTrain(trainState({ lastObservation: obs({ observedAt: ago(400), chainage: -6000, speedKmh: 60 }) }), now, t);
    expect(r.source).toBe('LATEST_OBSERVATION');
    expect(r.level).toBe(2);
    expect(r.positionChainage).toBeGreaterThan(-6000 + 6000); // moved ~6.7 km
    expect(['MEDIUM', 'LOW']).toContain(r.predictions[0].confidence);
  });

  test('Level 3: too-old position + recent delay -> TIMETABLE_WITH_DELAY', () => {
    const r = predictTrain(trainState({
      lastObservation: obs({ observedAt: ago(3600) }),
      timing: timing(5),
      knownDelay: { minutes: 7, observedAt: ago(600) }
    }), now, t);
    expect(r.source).toBe('TIMETABLE_WITH_DELAY');
    const p19 = r.predictions.find((p) => p.phatakNumber === 19);
    const scheduled = 5 * 60 + (corridor.getCrossing(19).chainage / corridor.CORRIDOR_LENGTH_M) * 15 * 60;
    expect(p19.etaSeconds).toBeCloseTo(scheduled + 7 * 60, -1);
    expect(p19.confidence).toBe('MEDIUM');
    expect(p19.positional).toBe(false);
  });

  test('Level 4: historical average needs enough samples', () => {
    const hist = Object.fromEntries(corridor.CROSSINGS.map((c) => [c.number, { meanOffsetSeconds: 600, stdSeconds: 60, samples: 6 }]));
    const r = predictTrain(trainState({ timing: timing(10), historical: hist }), now, t);
    expect(r.source).toBe('HISTORICAL_AVERAGE');
    expect(r.predictions[0].etaSeconds).toBe(20 * 60);
    const few = Object.fromEntries(corridor.CROSSINGS.map((c) => [c.number, { meanOffsetSeconds: 600, stdSeconds: 60, samples: 2 }]));
    expect(predictTrain(trainState({ timing: timing(10), historical: few }), now, t).source).toBe('TIMETABLE_ESTIMATE');
  });

  test('Level 5: timetable only -> LOW confidence', () => {
    const r = predictTrain(trainState({ timing: timing(8) }), now, t);
    expect(r.source).toBe('TIMETABLE_ESTIMATE');
    expect(r.predictions.every((p) => p.confidence === 'LOW')).toBe(true);
  });

  test('UNKNOWN when nothing is available', () => {
    const r = predictTrain(trainState(), now, t);
    expect(r.source).toBe('UNKNOWN');
    expect(r.predictions.every((p) => p.status === 'UNKNOWN' && p.confidence === 'NONE')).toBe(true);
    expect(predictTrain(trainState({ direction: 'UNKNOWN', lastObservation: obs() }), now, t).source).toBe('UNKNOWN');
  });

  test('stale delay is ignored', () => {
    const r = predictTrain(trainState({ timing: timing(8), knownDelay: { minutes: 30, observedAt: ago((t.RECENT_DELAY_VALIDITY_MINUTES + 5) * 60) } }), now, t);
    expect(r.source).toBe('TIMETABLE_ESTIMATE');
  });

  test('train stopped at Patiala: ETA includes remaining dwell, not distance threshold', () => {
    const r = predictTrain(trainState({
      lastObservation: obs({ observedAt: ago(5), chainage: 0, speedKmh: 0, atStation: true, currentStationCode: 'PTA' }),
      timing: timing(3)
    }), now, t);
    const p19 = r.predictions.find((p) => p.phatakNumber === 19);
    expect(p19.stoppedNow).toBe(true);
    expect(p19.etaSeconds).toBeGreaterThan(170); // ~175 s dwell + travel
  });

  test('DBN -> PTA direction meets 24 first', () => {
    const r = predictTrain(trainState({ direction: 'DHABLAN_TO_PATIALA', lastObservation: obs({ observedAt: ago(1), chainage: 12500 }) }), now, t);
    const etas = Object.fromEntries(r.predictions.map((p) => [p.phatakNumber, p.etaSeconds]));
    expect(etas[24]).toBeLessThan(etas[23]);
    expect(etas[23]).toBeLessThan(etas[20]);
    expect(etas[20]).toBeLessThan(etas[19]);
  });

  test('confidence is reduced for long horizons', () => {
    const r = predictTrain(trainState({ lastObservation: obs({ observedAt: ago(1), chainage: -60000, speedKmh: 60 }) }), now, t);
    expect(r.predictions[0].etaSeconds).toBeGreaterThan(3600);
    expect(r.predictions[0].confidence).toBe('LOW');
  });
});
