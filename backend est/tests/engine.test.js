const { fakeClock, obs } = require('./helpers');
const { CorridorEngine } = require('../src/services/engine/corridorEngine');
const { AlertService } = require('../src/services/alert/alertService');

function setup() {
  const clock = fakeClock();
  const created = [];
  const alertService = new AlertService({ now: clock });
  alertService.create = async (doc) => { created.push(doc); return doc; };
  const engine = new CorridorEngine({ clock, persist: false, alertService });
  const events = [];
  engine.setEmitter({ emit: (e, p) => events.push([e, p]) });
  return { clock, engine, created, events };
}

/** Drive one train along the corridor, ingesting a position every `stepS` seconds. */
async function drive(engine, clock, { train = 'S1', from, to, speedKmh, stepS = 5, direction = 'PATIALA_TO_DHABLAN' }) {
  const sign = direction === 'PATIALA_TO_DHABLAN' ? 1 : -1;
  const v = speedKmh / 3.6;
  const states = [];
  for (let s = from; sign > 0 ? s <= to : s >= to; s += sign * v * stepS) {
    clock.advance(stepS * 1000);
    engine.ingestObservation(train, obs({ chainage: s, speedKmh, observedAt: clock() }));
    await engine.evaluate();
    states.push(Object.fromEntries([19, 20, 23, 24].map((n) => [n, engine.gsm.get(n).state])));
  }
  return states;
}

const dedupe = (arr) => arr.filter((x, i) => i === 0 || x !== arr[i - 1]);

describe('corridor engine (same pipeline for live & simulation)', () => {
  test('crossings start UNKNOWN then OPEN with no trains', async () => {
    const { engine } = setup();
    expect(engine.snapshot().crossings.every((c) => c.state === 'UNKNOWN')).toBe(true);
    await engine.evaluate();
    expect(engine.snapshot().crossings.every((c) => c.state === 'OPEN')).toBe(true);
  });

  test('a train run produces the full state sequence at every crossing', async () => {
    const { engine, clock, created } = setup();
    await engine.evaluate();
    engine.upsertTrain('S1', { trainName: 'Sim', direction: 'PATIALA_TO_DHABLAN', isSimulated: true });
    const states = await drive(engine, clock, { from: -12000, to: 7000, speedKmh: 60 });
    for (const n of [19, 20, 23, 24]) {
      expect(dedupe(states.map((s) => s[n]))).toEqual(['OPEN', 'CLOSING_SOON', 'CLOSED', 'OPENING_SOON', 'OPEN']);
    }
    // Crossing 19 closes before 24
    const firstClosed = (n) => states.findIndex((s) => s[n] === 'CLOSED');
    expect(firstClosed(19)).toBeLessThan(firstClosed(24));
    // Alerts: one per transition per crossing, no duplicates
    const gateAlerts = created.filter((a) => a.type === 'GATE_STATUS_CHANGE');
    const keys = gateAlerts.map((a) => a.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(created.some((a) => a.type === 'GROUPED_CLOSURE')).toBe(true);
  });

  test('opposite-direction trains: crossing never OPEN while second train is close', async () => {
    const { engine, clock } = setup();
    await engine.evaluate();
    engine.upsertTrain('A', { direction: 'PATIALA_TO_DHABLAN' });
    engine.upsertTrain('B', { direction: 'DHABLAN_TO_PATIALA' });
    const seen = [];
    let a = -2000; let b = 3300;
    for (let i = 0; i < 40; i++) {
      clock.advance(5000);
      a += 83; b -= 60;
      engine.ingestObservation('A', obs({ chainage: a, speedKmh: 60, observedAt: clock() }));
      engine.ingestObservation('B', obs({ chainage: b, speedKmh: 43, observedAt: clock() }));
      await engine.evaluate();
      seen.push(engine.gsm.get(20).state);
    }
    // Train A passes 20 (~1000 m) around step 36; B is ~2.3 km away and closing => not OPEN after A
    const afterA = seen.slice(seen.indexOf('OPENING_SOON') >= 0 ? seen.indexOf('OPENING_SOON') : seen.length);
    expect(afterA.includes('OPEN')).toBe(false);
  });

  test('outlier positions are rejected; repeated reverse movement flips direction', async () => {
    const { engine, clock } = setup();
    engine.upsertTrain('X', { direction: 'PATIALA_TO_DHABLAN' });
    expect(engine.ingestObservation('X', obs({ chainage: 0, observedAt: clock.advance(1000) })).accepted).toBe(true);
    expect(engine.ingestObservation('X', obs({ chainage: 8000, observedAt: clock.advance(5000) })).reason).toBe('OUTLIER');
    expect(engine.ingestObservation('X', obs({ chainage: -400, observedAt: clock.advance(30000) })).reason).toBe('REVERSE_MOVEMENT_UNCONFIRMED');
    expect(engine.ingestObservation('X', obs({ chainage: -800, observedAt: clock.advance(30000) })).accepted).toBe(true);
    expect(engine.trains.get('X').direction).toBe('DHABLAN_TO_PATIALA');
  });

  test('older / duplicate observations and missing positions are not used as positions', () => {
    const { engine, clock } = setup();
    engine.upsertTrain('X', { direction: 'PATIALA_TO_DHABLAN' });
    const t0 = clock.advance(1000);
    engine.ingestObservation('X', obs({ chainage: 0, observedAt: t0 }));
    expect(engine.ingestObservation('X', obs({ chainage: 50, observedAt: t0 })).reason).toBe('NOT_NEWER');
    const r = engine.ingestObservation('X', obs({ chainage: null, delayMinutes: 9, observedAt: clock.advance(5000) }));
    expect(r.reason).toBe('NO_POSITION');
    expect(engine.trains.get('X').knownDelay.minutes).toBe(9);
    expect(engine.ingestObservation('NOPE', obs()).reason).toBe('UNKNOWN_TRAIN');
  });

  test('stale data degrades the prediction source over time', async () => {
    const { engine, clock } = setup();
    engine.upsertTrain('X', {
      direction: 'PATIALA_TO_DHABLAN',
      timing: { direction: 'PATIALA_TO_DHABLAN', entryTime: clock.advance(0), exitTime: new Date(clock().getTime() + 900000) }
    });
    engine.ingestObservation('X', obs({ chainage: -20000, speedKmh: 40, observedAt: clock.advance(1000) }));
    await engine.evaluate();
    expect(engine.lastTrainResults.get('X').source).toBe('LIVE_POSITION');
    clock.advance(300000); await engine.evaluate();
    expect(engine.lastTrainResults.get('X').source).toBe('LATEST_OBSERVATION');
    expect(engine.trainView(engine.trains.get('X')).isStale).toBe(true);
    clock.advance(1200000); await engine.evaluate();
    expect(engine.lastTrainResults.get('X').source).toBe('TIMETABLE_WITH_DELAY');
  });

  test('timetable-only train can warn CLOSING_SOON but never CLOSED', async () => {
    const { engine, clock } = setup();
    const now = clock();
    engine.upsertTrain('TT', { direction: 'PATIALA_TO_DHABLAN', timing: { direction: 'PATIALA_TO_DHABLAN', entryTime: new Date(now.getTime() + 60000), exitTime: new Date(now.getTime() + 960000) } });
    const states = [];
    for (let i = 0; i < 30; i++) { clock.advance(30000); await engine.evaluate(); states.push(engine.gsm.get(19).state); }
    expect(states).toContain('CLOSING_SOON');
    expect(states).not.toContain('CLOSED');
    expect(states).not.toContain('OPENING_SOON');
  });

  test('live and simulation modes are separated', async () => {
    const { engine } = setup();
    await engine.setMode('LIVE');
    engine.upsertTrain('L', { direction: 'PATIALA_TO_DHABLAN' });
    expect(engine.ingestObservation('L', obs(), { mode: 'SIMULATION' }).reason).toBe('MODE_MISMATCH');
    await engine.setMode('SIMULATION');
    expect(engine.trains.size).toBe(0);
    expect(engine.snapshot().mode).toBe('SIMULATION');
  });

  test('snapshot shape for clients', async () => {
    const { engine, clock, events } = setup();
    engine.upsertTrain('S', { direction: 'DHABLAN_TO_PATIALA', trainName: 'S train' });
    engine.ingestObservation('S', obs({ chainage: 6000, observedAt: clock.advance(1000) }));
    await engine.evaluate();
    const snap = engine.snapshot();
    expect(snap.seq).toBeGreaterThan(0);
    expect(snap.crossings).toHaveLength(4);
    expect(snap.crossings[0]).toEqual(expect.objectContaining({ number: expect.any(Number), state: expect.any(String), isPrediction: true, predictions: expect.any(Array) }));
    const tr = snap.trains[0];
    expect(tr).toEqual(expect.objectContaining({ trainNumber: 'S', source: 'LIVE_POSITION', corridorStatus: 'IN_CORRIDOR', coordinates: expect.any(Array), heading: expect.any(Number) }));
    expect(tr.nextCrossing.phatakNumber).toBe(24);
    expect(snap.system.disclaimer).toMatch(/not physical gate sensor readings/);
    expect(events.some(([e]) => e === 'corridor:snapshot')).toBe(true);
  });
});
