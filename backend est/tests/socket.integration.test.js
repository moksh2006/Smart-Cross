const http = require('http');
const { io: ioClient } = require('socket.io-client');
const { CorridorEngine } = require('../src/services/engine/corridorEngine');
const { AlertService } = require('../src/services/alert/alertService');
const socketManager = require('../src/services/websocket/socketManager');
const { fakeClock, obs } = require('./helpers');

let server; let client; let engine; let clock; let url;

beforeAll(async () => {
  clock = fakeClock(new Date());
  const alertService = new AlertService({ now: clock, emit: (a) => socketManager.emit('alert:new', a) });
  alertService.create = async (doc) => { const a = { ...doc, _id: `${doc.dedupeKey}:${Math.random()}` }; alertService.emit(a); return a; };
  engine = new CorridorEngine({ clock, persist: false, alertService });
  engine.setEmitter(socketManager);
  server = http.createServer();
  socketManager.init(server, { origins: '*', snapshotProvider: () => engine.snapshot() });
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (client) client.close();
  socketManager.close();
  await new Promise((r) => server.close(r));
});

const once = (event, pred = () => true, timeout = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
  const h = (payload) => { if (pred(payload)) { clearTimeout(timer); client.off(event, h); resolve(payload); } };
  client.on(event, h);
});

describe('Socket.IO real-time updates', () => {
  test('client receives a snapshot on connect', async () => {
    client = ioClient(url, { transports: ['websocket'], reconnection: true });
    const snap = await once('corridor:snapshot');
    expect(snap.crossings).toHaveLength(4);
    expect(typeof snap.seq).toBe('number');
  });

  test('train position, gate change and alert events are broadcast', async () => {
    await engine.evaluate();
    engine.upsertTrain('S1', { direction: 'PATIALA_TO_DHABLAN' });
    const gate = once('gate:status-change', (p) => p.phatakNumber === 19 && p.newStatus === 'CLOSED');
    const alert = once('alert:new', (a) => a.status === 'CLOSED');
    const train = once('train:update', (t) => t.trainNumber === 'S1');
    engine.ingestObservation('S1', obs({ chainage: 0, speedKmh: 50, observedAt: clock.advance(1000) }));
    await engine.evaluate();
    const [g, a, t] = await Promise.all([gate, alert, train]);
    expect(g).toMatchObject({ previousStatus: 'OPEN', isPrediction: true, mode: 'SIMULATION' });
    expect(a.severity).toBe('CRITICAL');
    expect(t.coordinates).toHaveLength(2);
  });

  test('snapshot sequence numbers increase (clients can drop stale events)', async () => {
    const before = engine.seq;
    const next = once('corridor:snapshot', (s) => s.seq > before);
    engine.ingestObservation('S1', obs({ chainage: 50, speedKmh: 50, observedAt: clock.advance(2000) }));
    await engine.evaluate();
    const s2 = await next;
    expect(s2.seq).toBeGreaterThan(before);
  });

  test('client can request a snapshot after reconnecting', async () => {
    client.disconnect();
    client.connect();
    const snap = await once('corridor:snapshot');
    expect(snap.crossings.find((c) => c.number === 19).state).toBe('CLOSED');
    client.emit('snapshot:request');
    await once('corridor:snapshot');
  });
});
