const live = require('./fixtures/liveStatus.json');
const details = require('./fixtures/trainDetails.json');
const { normalizeLiveStatus, normalizeSchedule, normalizeRoute } = require('../src/services/railradar/trainDataNormalizer');
const { resolveChainage } = require('../src/services/gis/positionResolver');
const { inferDirection, corridorTiming } = require('../src/services/railradar/trainScheduleService');

describe('RailRadar live status normalization (documented schema)', () => {
  const receivedAt = new Date('2026-11-12T01:51:10Z');
  test('extracts speed, delay, timestamp, route distances', () => {
    const n = normalizeLiveStatus(live, { trainNumber: '14508', receivedAt });
    expect(n.ok).toBe(true);
    expect(n.speedKmh).toBe(58);
    expect(n.delayMinutes).toBe(6);
    expect(n.observedAt.toISOString()).toBe('2026-11-12T01:51:00.000Z');
    expect(n.distanceFromOriginKm).toBe(262.5);
    expect(n.route.find((r) => r.stationCode === 'PTA').distanceKm).toBe(271);
    expect(n.gps).toBeNull();
    expect(n.atStation).toBe(false);
  });
  test('position derives from distanceFromOriginKm between DBN and PTA', () => {
    const n = normalizeLiveStatus(live, { trainNumber: '14508', receivedAt });
    const pos = resolveChainage(n);
    expect(pos.method).toBe('ROUTE_DISTANCE');
    // 262.5 km is 4.5 km past DBN (258) towards PTA (271)
    expect(pos.chainage).toBeGreaterThan(7000);
    expect(pos.chainage).toBeLessThan(8000);
  });
  test('rejects failure, empty and mismatched payloads', () => {
    expect(normalizeLiveStatus(null, { trainNumber: '1' }).ok).toBe(false);
    expect(normalizeLiveStatus({ success: false }, { trainNumber: '1' }).ok).toBe(false);
    expect(normalizeLiveStatus({ success: true }, { trainNumber: '1' }).ok).toBe(false);
    const m = normalizeLiveStatus(live, { trainNumber: '99999' });
    expect(m.ok).toBe(false);
    expect(m.issues[0]).toMatch(/TRAIN_NUMBER_MISMATCH/);
  });
  test('invalid values are nulled with issues, not invented', () => {
    const bad = JSON.parse(JSON.stringify(live));
    bad.data.currentLocation.speedKmh = 999;
    bad.data.currentLocation.distanceFromOriginKm = null;
    delete bad.data.lastUpdatedAt;
    delete bad.meta;
    const n = normalizeLiveStatus(bad, { trainNumber: '14508', receivedAt });
    expect(n.speedKmh).toBeNull();
    expect(n.distanceFromOriginKm).toBeNull();
    expect(n.issues).toEqual(expect.arrayContaining(['SPEED_OUT_OF_RANGE', 'NO_TIMESTAMP_USING_RECEIVED_AT', 'NO_POSITION']));
    expect(n.observedAt).toEqual(receivedAt);
  });
  test('future timestamps are clamped', () => {
    const f = JSON.parse(JSON.stringify(live));
    f.data.lastUpdatedAt = '2030-01-01T00:00:00Z';
    const n = normalizeLiveStatus(f, { trainNumber: '14508', receivedAt });
    expect(n.issues).toContain('TIMESTAMP_IN_FUTURE');
    expect(n.observedAt).toEqual(receivedAt);
  });
  test('status flags', () => {
    const f = JSON.parse(JSON.stringify(live));
    f.data.status = 'not-started';
    expect(normalizeLiveStatus(f, { trainNumber: '14508' }).notStarted).toBe(true);
  });
});

describe('schedule normalization', () => {
  test('GET /v1/trains/{n} -> stops with HH:MM and direction', () => {
    const s = normalizeSchedule(details, { trainNumber: '14508' });
    expect(s.stops).toHaveLength(3);
    expect(s.stops[1]).toMatchObject({ stationCode: 'DBN', arrivalTime: '07:17', distanceKm: 258 });
    expect(s.runningDays).toContain('MON');
    expect(inferDirection(s.stops)).toBe('DHABLAN_TO_PATIALA');
  });
  test('corridor timing uses IST and departure at entry / arrival at exit', () => {
    const s = normalizeSchedule(details, { trainNumber: '14508' });
    s.corridorDirection = 'DHABLAN_TO_PATIALA';
    const t = corridorTiming(s, '2026-11-12');
    expect(t.entryTime.toISOString()).toBe('2026-11-12T01:47:00.000Z'); // 07:17 IST
    expect(t.exitTime.toISOString()).toBe('2026-11-12T01:59:00.000Z');  // 07:29 IST
    expect(t.ptaKm).toBe(271);
  });
  test('route geometry normalization', () => {
    const r = normalizeRoute({ data: { trainNumber: '1', geojson: { geometry: { coordinates: [[76, 30], [76.1, 30.1], ['x', 1]] } }, stops: [{ code: 'pta', lat: 30, lng: 76 }] } }, { trainNumber: '1' });
    expect(r.geometry.coordinates).toHaveLength(2);
    expect(r.stops[0].stationCode).toBe('PTA');
    expect(normalizeSchedule({ data: {} }, { trainNumber: '1' })).toBeNull();
  });
});
