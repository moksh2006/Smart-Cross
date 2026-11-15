const { fakeClock } = require('./helpers');
const { CorridorEngine } = require('../src/services/engine/corridorEngine');
const { SimulationEngine, SCENARIOS } = require('../src/services/simulation/simulationEngine');

function setup() {
  const clock = fakeClock();
  const engine = new CorridorEngine({ clock, persist: false });
  const sim = new SimulationEngine({ engine, clock });
  return { clock, engine, sim };
}

async function run(sim, engine, clock, seconds, stepMs = 1000) {
  for (let i = 0; i < seconds * 1000 / stepMs; i++) {
    clock.advance(stepMs);
    sim.tick(clock());
    await engine.evaluate();
  }
}

afterEach(() => jest.clearAllTimers());

describe('simulation engine', () => {
  test('adding a train switches to SIMULATION mode and feeds the shared engine', async () => {
    const { engine, sim, clock } = setup();
    await engine.setMode('LIVE');
    const v = await sim.addTrain({ trainNumber: '14736', direction: 'PATIALA_TO_DHABLAN', speedKmh: 72, start: { type: 'BEFORE_ENTRY', meters: 1000 } });
    sim.stop();
    expect(engine.mode).toBe('SIMULATION');
    expect(v.trainNumber).toBe('SIM-14736');
    expect(v.isSimulated).toBe(true);
    await run(sim, engine, clock, 10);
    const t = engine.trainView(engine.trains.get('SIM-14736'));
    expect(t.dataSource).toBe('SIMULATION');
    expect(t.positionMethod).toBe('ROUTE_DISTANCE'); // went through mock RailRadar payload + resolver
    expect(t.isSimulated).toBe(true);
    expect(t.positionChainage).toBeGreaterThan(-1000);
  });

  test('speed control and stopping the train', async () => {
    const { engine, sim, clock } = setup();
    await sim.addTrain({ trainNumber: '1', direction: 'DHABLAN_TO_PATIALA', speedKmh: 60, start: { type: 'CHAINAGE', meters: 9000 } });
    sim.stop();
    await run(sim, engine, clock, 5);
    const before = sim.trains.get('SIM-1').chainage;
    sim.updateTrain('SIM-1', { speedKmh: 0 });
    await run(sim, engine, clock, 40);
    const stopped = sim.trains.get('SIM-1');
    expect(stopped.speedKmh).toBe(0);
    expect(stopped.chainage).toBeLessThan(before);
    const pos = stopped.chainage;
    await run(sim, engine, clock, 10);
    expect(sim.trains.get('SIM-1').chainage).toBeCloseTo(pos, 5);
  });

  test('delay hold keeps the train at the station', async () => {
    const { engine, sim, clock } = setup();
    await sim.addTrain({ trainNumber: '2', direction: 'PATIALA_TO_DHABLAN', speedKmh: 50, holdMinutes: 2, delayMinutes: 2, start: { type: 'ENTRY_STATION' } });
    sim.stop();
    await run(sim, engine, clock, 30);
    expect(sim.view(sim.trains.get('SIM-2')).holding).toBe(true);
    expect(engine.trainView(engine.trains.get('SIM-2')).delayMinutes).toBe(2);
    await run(sim, engine, clock, 120);
    expect(sim.trains.get('SIM-2').chainage).toBeGreaterThan(0);
  });

  test('signal loss falls back to dead reckoning (LATEST_OBSERVATION)', async () => {
    const { engine, sim, clock } = setup();
    await sim.addTrain({ trainNumber: '3', direction: 'PATIALA_TO_DHABLAN', speedKmh: 40, start: { type: 'BEFORE_ENTRY', meters: 5000 } });
    sim.stop();
    await run(sim, engine, clock, 5);
    sim.updateTrain('SIM-3', { signalLost: true });
    await run(sim, engine, clock, 200, 5000);
    expect(engine.lastTrainResults.get('SIM-3').source).toBe('LATEST_OBSERVATION');
  });

  test('scenarios are valid and multiple trains are supported', async () => {
    for (const name of Object.keys(SCENARIOS)) {
      const { sim } = setup();
      const r = await sim.startScenario(name);
      sim.stop();
      expect(r.trains.length).toBe(SCENARIOS[name].trains.length);
    }
  });

  test('grouped closure scenario produces a Group B advisory in sequence 24 -> 23', async () => {
    const { engine, sim, clock } = setup();
    await sim.startScenario('grouped-closure-b');
    sim.stop();
    let adv = [];
    for (let i = 0; i < 300 && !adv.some((a) => a.groupId === 'B'); i++) { await run(sim, engine, clock, 2); adv = engine.advisories; }
    const b = adv.find((a) => a.groupId === 'B');
    expect(b.sequence).toEqual([24, 23]);
  });

  test('input validation', async () => {
    const { sim } = setup();
    await expect(sim.addTrain({ direction: 'NORTH' })).rejects.toThrow(/direction/);
    await expect(sim.addTrain({ direction: 'PATIALA_TO_DHABLAN', speedKmh: 500 })).rejects.toThrow(/speedKmh/);
    await expect(sim.addTrain({ direction: 'PATIALA_TO_DHABLAN', start: { type: 'BEFORE_CROSSING', phatakNumber: 99 } })).rejects.toThrow(/phatakNumber/);
    await expect(sim.startScenario('nope')).rejects.toThrow(/Unknown scenario/);
    expect(() => sim.updateTrain('SIM-none', {})).toThrow(/not found/);
  });
});
