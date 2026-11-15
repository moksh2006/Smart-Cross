const { fakeClock } = require('./helpers');
const { CorridorEngine } = require('../src/services/engine/corridorEngine');
const { TrainPollingScheduler } = require('../src/services/scheduler/trainPollingScheduler');
const settings = require('../src/services/settings/settingsService');
const historical = require('../src/services/prediction/historicalService');
const trainScheduleService = require('../src/services/railradar/trainScheduleService');

jest.mock('../src/services/railradar/trainScheduleService', () => {
  const actual = jest.requireActual('../src/services/railradar/trainScheduleService');
  return { ...actual, getSchedule: jest.fn(async (n) => actual.bundledSchedule(n)) };
});

function fakeClient({ budget = 30, callsToday = 0, can = { ok: true } } = {}) {
  return {
    isConfigured: () => true,
    canCallNow: () => can,
    status: () => ({ dailyBudget: budget, callsToday })
  };
}

function setup(clockStart, clientOpts) {
  const clock = fakeClock(clockStart);
  const engine = new CorridorEngine({ clock, persist: false });
  engine.mode = 'LIVE';
  const fetchLive = jest.fn(async () => ({ ok: false, errorCode: 'NOT_FOUND' }));
  const scheduler = new TrainPollingScheduler({ engine, clock, fetchLive, apiClient: fakeClient(clientOpts) });
  scheduler.running = true;
  return { clock, engine, scheduler, fetchLive };
}

beforeAll(() => {
  jest.spyOn(settings, 'monitoredTrains').mockReturnValue(['14508']); // DBN 07:17 IST -> PTA 07:29 IST
  jest.spyOn(historical, 'getTrainHistory').mockResolvedValue({ perCrossing: {}, avgSpeedKmh: null });
});
afterAll(() => jest.restoreAllMocks());

describe('adaptive polling scheduler', () => {
  test('does not poll far outside the corridor window', async () => {
    const { scheduler, fetchLive, engine } = setup('2026-11-12T00:30:00Z'); // 06:00 IST
    await scheduler.tick();
    expect(fetchLive).not.toHaveBeenCalled();
    expect(engine.trains.has('14508')).toBe(true); // tracked with timetable (within 90 min look-ahead)
  });

  test('starts polling ~20 min before expected entry', async () => {
    const { scheduler, fetchLive } = setup('2026-11-12T01:30:00Z'); // 07:00 IST, entry 07:17
    await scheduler.tick();
    expect(fetchLive).toHaveBeenCalledTimes(1);
    expect(fetchLive.mock.calls[0][0]).toBe('14508');
    expect(fetchLive.mock.calls[0][1].kmPosts).toEqual({ ptaKm: 271, dbnKm: 258 });
  });

  test('respects interval: no duplicate request on the next tick', async () => {
    const { scheduler, fetchLive, clock } = setup('2026-11-12T01:30:00Z');
    await scheduler.tick();
    clock.advance(10000);
    await scheduler.tick();
    expect(fetchLive).toHaveBeenCalledTimes(1);
    clock.advance(200000);
    await scheduler.tick();
    expect(fetchLive).toHaveBeenCalledTimes(2);
  });

  test('budget spent: only trains about to reach a crossing are polled', async () => {
    const { scheduler, fetchLive } = setup('2026-11-12T01:30:00Z', { budget: 10, callsToday: 10 });
    await scheduler.tick();
    expect(fetchLive).not.toHaveBeenCalled();
    expect(scheduler.plans.get('14508').lastResult).toBe('SKIPPED_BUDGET');
  });

  test('client limits stop polling', async () => {
    const { scheduler, fetchLive } = setup('2026-11-12T01:30:00Z', { can: { ok: false, reason: 'PER_MINUTE_LIMIT' } });
    await scheduler.tick();
    expect(fetchLive).not.toHaveBeenCalled();
  });

  test('stops after the train has left (post-clear window)', async () => {
    const { scheduler, fetchLive, engine } = setup('2026-11-12T02:20:00Z'); // 07:50 IST, exit 07:29 + 10 min
    await scheduler.tick();
    expect(fetchLive).not.toHaveBeenCalled();
    expect(engine.trains.has('14508')).toBe(false);
  });

  test('successful live observation is ingested into the engine', async () => {
    const { scheduler, fetchLive, engine, clock } = setup('2026-11-12T01:50:00Z');
    fetchLive.mockResolvedValueOnce({ ok: true, observation: { chainage: 8000, speedKmh: 55, observedAt: clock(), delayMinutes: 3, atStation: false, currentStationCode: '', positionMethod: 'ROUTE_DISTANCE', trainName: 'x' } });
    await scheduler.tick();
    const t = engine.trains.get('14508');
    expect(t.lastObservation.chainage).toBe(8000);
    expect(t.knownDelay.minutes).toBe(3);
    await engine.evaluate();
    expect(engine.lastTrainResults.get('14508').source).toBe('LIVE_POSITION');
  });

  test('never polls in SIMULATION mode', async () => {
    const { scheduler, fetchLive, engine } = setup('2026-11-12T01:30:00Z');
    engine.mode = 'SIMULATION';
    await scheduler.tick();
    expect(fetchLive).not.toHaveBeenCalled();
    expect(trainScheduleService.getSchedule).toBeDefined();
  });
});
