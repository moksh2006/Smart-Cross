const corridor = require('../src/config/corridor');
const { haversineDistance, calculatePolylineLength } = require('../src/services/gis/distanceCalculator');
const { dmsToDecimal, dmsToGeoJsonPoint } = require('../src/services/gis/coordinateConverter');
const { projectPointOnTrack, pointAtDistance } = require('../src/services/gis/routeGeometryProcessor');
const { resolveChainage } = require('../src/services/gis/positionResolver');

describe('distance & coordinate helpers', () => {
  test('haversine distance PTA->DBN is ~11.8 km straight line', () => {
    const d = haversineDistance(corridor.STATIONS.PTA.coordinates, corridor.STATIONS.DBN.coordinates);
    expect(d).toBeGreaterThan(11500);
    expect(d).toBeLessThan(12100);
  });
  test('polyline length of empty/short lines is 0', () => {
    expect(calculatePolylineLength([])).toBe(0);
    expect(calculatePolylineLength([[76, 30]])).toBe(0);
  });
  test('DMS conversion matches configured decimals for all crossings', () => {
    for (const c of corridor.CROSSINGS) {
      expect(dmsToDecimal(c.dms.lat)).toBeCloseTo(c.lat, 5);
      expect(dmsToDecimal(c.dms.lon)).toBeCloseTo(c.lon, 5);
      expect(dmsToGeoJsonPoint(c.dms.lat, c.dms.lon).coordinates).toEqual([c.lon, c.lat]);
    }
  });
  test('invalid DMS throws', () => {
    expect(() => dmsToDecimal('not-a-coordinate')).toThrow();
  });
});

describe('corridor configuration (OSM-derived geometry)', () => {
  test('every crossing lies within 5 m of the OSM railway line', () => {
    for (const c of corridor.CROSSINGS) expect(c.offTrackMeters).toBeLessThan(5);
  });
  test('crossings are ordered PTA -> 19 -> 20 -> 23 -> 24 -> DBN by chainage', () => {
    expect(corridor.crossingOrder('PATIALA_TO_DHABLAN').map((c) => c.number)).toEqual([19, 20, 23, 24]);
    expect(corridor.crossingOrder('DHABLAN_TO_PATIALA').map((c) => c.number)).toEqual([24, 23, 20, 19]);
    const ch = corridor.crossingOrder('PATIALA_TO_DHABLAN').map((c) => c.chainage);
    expect(ch[0]).toBeGreaterThan(0);
    expect(ch[3]).toBeLessThan(corridor.STATIONS.DBN.chainage);
  });
  test('corridor length is plausible (11-13 km)', () => {
    expect(corridor.CORRIDOR_LENGTH_M).toBeGreaterThan(11000);
    expect(corridor.CORRIDOR_LENGTH_M).toBeLessThan(13000);
  });
  test('chainageOf / pointAtChainage round trip', () => {
    for (const s of [-1500, 0, 2500, 6000, 11000, 13000]) {
      const p = corridor.pointAtChainage(s);
      expect(corridor.chainageOf(p).chainage).toBeCloseTo(s, -1);
    }
  });
  test('signed along-track distance respects direction', () => {
    const c19 = corridor.getCrossing(19);
    expect(corridor.distanceAhead(0, c19.chainage, 'PATIALA_TO_DHABLAN')).toBeGreaterThan(0);
    expect(corridor.distanceAhead(0, c19.chainage, 'DHABLAN_TO_PATIALA')).toBeLessThan(0);
    expect(corridor.distanceAhead(0, 100, 'UNKNOWN')).toBe(0);
  });
  test('groups contain configured crossings', () => {
    expect(corridor.GROUPS.find((g) => g.id === 'A').crossings).toEqual([19, 20]);
    expect(corridor.GROUPS.find((g) => g.id === 'B').crossings).toEqual([23, 24]);
  });
  test('projection rejects invalid input', () => {
    expect(() => projectPointOnTrack([NaN, 30], corridor.REGIONAL_LINE)).toThrow();
    expect(() => projectPointOnTrack([76, 30], [[76, 30]])).toThrow();
    expect(pointAtDistance([[0, 0], [0, 1]], -10)).toEqual([0, 0]);
  });
});

describe('position resolver', () => {
  const base = { gps: null, route: [], distanceFromOriginKm: null, atStation: false, currentStationCode: '' };
  test('route distance maps km posts onto the corridor (DBN -> PTA)', () => {
    const r = resolveChainage({ ...base, distanceFromOriginKm: 264.5, route: [{ stationCode: 'DBN', distanceKm: 258 }, { stationCode: 'PTA', distanceKm: 271 }] });
    expect(r.method).toBe('ROUTE_DISTANCE');
    expect(r.chainage).toBeCloseTo(corridor.CORRIDOR_LENGTH_M * 0.5, -1);
  });
  test('route distance (PTA -> DBN) and timetable km fallback', () => {
    const r = resolveChainage({ ...base, distanceFromOriginKm: 53 }, { ptaKm: 53, dbnKm: 66 });
    expect(r.chainage).toBeCloseTo(0, 1);
    const r2 = resolveChainage({ ...base, distanceFromOriginKm: 66 }, { ptaKm: 53, dbnKm: 66 });
    expect(r2.chainage).toBeCloseTo(corridor.CORRIDOR_LENGTH_M, 0);
  });
  test('GPS on track is used; GPS far off track is rejected', () => {
    const c23 = corridor.getCrossing(23);
    const ok = resolveChainage({ ...base, gps: { lat: c23.lat, lng: c23.lon } });
    expect(ok.method).toBe('GPS');
    expect(ok.chainage).toBeCloseTo(c23.chainage, -1);
    const bad = resolveChainage({ ...base, gps: { lat: 30.40, lng: 76.38 } });
    expect(bad.method).toBe('NONE');
    expect(bad.issues[0]).toMatch(/GPS_OFF_TRACK/);
  });
  test('implausible km posts are rejected', () => {
    const r = resolveChainage({ ...base, distanceFromOriginKm: 10 }, { ptaKm: 0, dbnKm: 100 });
    expect(r.method).toBe('NONE');
    expect(r.issues).toContain('IMPLAUSIBLE_KM_POSTS');
  });
  test('station snapping for at-station PTA', () => {
    expect(resolveChainage({ ...base, atStation: true, currentStationCode: 'PTA' })).toMatchObject({ method: 'STATION', chainage: 0 });
  });
  test('no position data yields NONE (never invented)', () => {
    expect(resolveChainage(base)).toMatchObject({ method: 'NONE', chainage: null });
  });
});
