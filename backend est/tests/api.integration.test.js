const request = require('supertest');
const { connectTestDb, disconnectTestDb } = require('./dbHelper');
const { createApp } = require('../src/app');
const { seedReferenceData } = require('../src/seeds/seed');
const settings = require('../src/services/settings/settingsService');
const { engine, simulation } = require('../src/services/runtime');
const { Phatak, TrainSchedule, Alert, GateEvent } = require('../src/models');

let app;
let token;

beforeAll(async () => {
  await connectTestDb('api');
  await seedReferenceData();
  await settings.load();
  await engine.setMode('SIMULATION');
  app = createApp();
  const res = await request(app).post('/api/auth/login').send({ password: 'test-admin-password' });
  token = res.body.data.token;
});

afterAll(async () => {
  await simulation.reset();
  simulation.stop();
  engine.stop();
  await disconnectTestDb();
});

const auth = (r) => r.set('Authorization', `Bearer ${token}`);

describe('public endpoints', () => {
  test('GET /api/health reports DB connectivity', async () => {
    const r = await request(app).get('/api/health').expect(200);
    expect(r.body).toMatchObject({ status: 'UP', db: { state: 'connected' } });
  });
  test('seed is idempotent and complete', async () => {
    await seedReferenceData();
    expect(await Phatak.countDocuments()).toBe(4);
    expect(await TrainSchedule.countDocuments()).toBe(15);
    const p = await Phatak.findOne({ number: 23 }).lean();
    expect(p.location.coordinates).toEqual([76.366583, 30.340222]);
    expect(p.group).toBe('B');
  });
  test('GET /api/corridor returns geometry, crossings, groups, directions', async () => {
    const r = await request(app).get('/api/corridor').expect(200);
    expect(r.body.data.crossings.map((c) => c.number)).toEqual([19, 20, 23, 24]);
    expect(r.body.data.directions[0].sequence).toEqual(['PTA', 19, 20, 23, 24, 'DBN']);
    expect(r.body.data.geometry.corridor.length).toBeGreaterThan(10);
  });
  test('GET /api/state snapshot', async () => {
    const r = await request(app).get('/api/state').expect(200);
    expect(r.body.data).toEqual(expect.objectContaining({ mode: 'SIMULATION', crossings: expect.any(Array), trains: expect.any(Array) }));
  });
  test('GET /api/phataks/:number and 404/400 handling', async () => {
    const r = await request(app).get('/api/phataks/19').expect(200);
    expect(r.body.data).toEqual(expect.objectContaining({ number: 19, groupInfo: expect.objectContaining({ id: 'A' }) }));
    await request(app).get('/api/phataks/99').expect(404);
    await request(app).get('/api/phataks/abc').expect(400);
  });
  test('GET /api/phataks/nearby validates input', async () => {
    const r = await request(app).get('/api/phataks/nearby?lat=30.3396&lon=76.3984&radius=800').expect(200);
    expect(r.body.data[0].number).toBe(19);
    await request(app).get('/api/phataks/nearby?lat=999&lon=76').expect(400);
  });
  test('GET /api/trains/:number returns bundled timetable', async () => {
    const r = await request(app).get('/api/trains/14508').expect(200);
    expect(r.body.data.schedule).toMatchObject({ source: 'BUNDLED_SEED', verified: false, direction: 'DHABLAN_TO_PATIALA' });
    await request(app).get('/api/trains/bad!!').expect(400);
  });
  test('unknown route -> JSON 404', async () => {
    const r = await request(app).get('/api/nope').expect(404);
    expect(r.body.success).toBe(false);
  });
  test('malformed JSON -> 400 without stack trace', async () => {
    const r = await request(app).post('/api/alerts/subscribe').set('Content-Type', 'application/json').send('{bad').expect(400);
    expect(JSON.stringify(r.body)).not.toMatch(/at .*\.js/);
  });
  test('POST /api/alerts/subscribe validates and upserts', async () => {
    await request(app).post('/api/alerts/subscribe').send({ clientId: 'x' }).expect(400);
    const r = await request(app).post('/api/alerts/subscribe').send({ clientId: 'client_12345', phatakNumbers: [19, 20], warningMinutes: 5 }).expect(200);
    expect(r.body.data.warningMinutes).toBe(5);
  });
});

describe('admin protection', () => {
  test('state-changing endpoints require a token', async () => {
    await request(app).put('/api/settings').send({ key: 'CLOSING_SOON_THRESHOLD_MINUTES', value: 8 }).expect(401);
    await request(app).post('/api/simulation/scenarios/single-pta-dbn').expect(401);
    await request(app).put('/api/admin/mode').send({ mode: 'LIVE' }).expect(401);
    await request(app).get('/api/admin/metrics').set('Authorization', 'Bearer forged.token.here').expect(401);
  });
  test('wrong password rejected', async () => {
    await request(app).post('/api/auth/login').send({ password: 'nope' }).expect(401);
  });
  test('settings validation and update', async () => {
    await auth(request(app).put('/api/settings')).send({ key: 'CLOSING_SOON_THRESHOLD_MINUTES', value: 500 }).expect(400);
    await auth(request(app).put('/api/settings')).send({ key: 'NOT_A_SETTING', value: 1 }).expect(400);
    const r = await auth(request(app).put('/api/settings')).send({ key: 'CLOSING_SOON_THRESHOLD_MINUTES', value: 8 }).expect(200);
    expect(r.body.data.thresholds.find((x) => x.key === 'CLOSING_SOON_THRESHOLD_MINUTES').value).toBe(8);
    expect(settings.thresholds().CLOSING_SOON_THRESHOLD_MINUTES).toBe(8);
    await auth(request(app).delete('/api/settings/CLOSING_SOON_THRESHOLD_MINUTES')).expect(200);
    expect(settings.thresholds().CLOSING_SOON_THRESHOLD_MINUTES).toBe(10);
  });
  test('LIVE mode refused without API key', async () => {
    await auth(request(app).put('/api/admin/mode')).send({ mode: 'LIVE' }).expect(400);
  });
  test('admin metrics and logs', async () => {
    const r = await auth(request(app).get('/api/admin/metrics')).expect(200);
    expect(r.body.data.railRadar.configured).toBe(false);
    await auth(request(app).get('/api/admin/api-logs?category=ADMIN_ACTION')).expect(200);
  });
});

describe('simulation through the API uses the shared engine', () => {
  test('scenario -> trains & predictions -> gate events/alerts persisted with SIMULATION mode', async () => {
    const sc = await auth(request(app).post('/api/simulation/scenarios/single-pta-dbn')).expect(200);
    expect(sc.body.data.trains[0].trainNumber).toBe('SIM-14736');
    await auth(request(app).post('/api/simulation/reset')).expect(200);
    // A train 200 m before Phatak 19 (same mock-RailRadar -> engine path as every simulated train)
    await auth(request(app).post('/api/simulation/trains'))
      .send({ trainNumber: '14736', direction: 'PATIALA_TO_DHABLAN', speedKmh: 40, start: { type: 'BEFORE_CROSSING', phatakNumber: 19, meters: 200 } })
      .expect(201);
    simulation.stop();
    await engine.evaluate();
    const state = await request(app).get('/api/state').expect(200);
    const c19 = state.body.data.crossings.find((c) => c.number === 19);
    expect(c19.state).toBe('CLOSED');
    expect(state.body.data.trains[0]).toMatchObject({ isSimulated: true, dataSource: 'SIMULATION' });
    const preds = await request(app).get('/api/predictions?phatak=19').expect(200);
    expect(preds.body.data.predictions[0]).toMatchObject({ trainNumber: 'SIM-14736', source: 'LIVE_POSITION' });
    expect(await GateEvent.countDocuments({ mode: 'SIMULATION', phatakNumber: 19, newStatus: 'CLOSED' })).toBe(1);
    expect(await Alert.countDocuments({ mode: 'SIMULATION' })).toBeGreaterThan(0);
    expect(await Alert.countDocuments({ mode: 'LIVE' })).toBe(0);
  });
  test('update / remove simulated trains and validation errors', async () => {
    await auth(request(app).patch('/api/simulation/trains/SIM-14736')).send({ speedKmh: 30 }).expect(200);
    await auth(request(app).patch('/api/simulation/trains/SIM-14736')).send({ speedKmh: -5 }).expect(400);
    await auth(request(app).post('/api/simulation/trains')).send({ direction: 'SIDEWAYS' }).expect(400);
    await auth(request(app).delete('/api/simulation/trains/SIM-14736')).expect(200);
    await auth(request(app).delete('/api/simulation/trains/SIM-14736')).expect(404);
  });
  test('alerts endpoint filters by mode and phatak', async () => {
    const r = await request(app).get('/api/alerts?mode=SIMULATION&phatak=19&limit=10').expect(200);
    expect(r.body.data.every((a) => a.mode === 'SIMULATION' && a.phatakNumbers.includes(19))).toBe(true);
    await request(app).get('/api/alerts?limit=9999').expect(400);
  });
  test('analytics summary labels data kinds', async () => {
    const r = await request(app).get('/api/analytics/summary?days=7&mode=SIMULATION').expect(200);
    const d = r.body.data;
    expect(d.trainFrequency.dataKind).toBe('RECORDED');
    expect(d.closurePatterns.dataKind).toBe('PREDICTED');
    expect(d.waitingTime.estimated.dataKind).toBe('ESTIMATED');
    expect(d.apiUsage.dataKind).toBe('API_LOG');
  });
  test('system status exposes disclaimer and mode', async () => {
    const r = await request(app).get('/api/system/status').expect(200);
    expect(r.body.data).toMatchObject({ mode: 'SIMULATION', liveAvailable: false, adminLoginEnabled: true });
    expect(r.body.data.disclaimer).toMatch(/not physical gate sensor/);
  });
});
