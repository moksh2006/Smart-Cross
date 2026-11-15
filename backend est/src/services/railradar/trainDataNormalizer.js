/**
 * Normalizes RailRadar responses to SmartCross' internal shape.
 * Field names follow the documented responses (railradar.in/docs, checked Nov 2026):
 *
 *  GET /v1/trains/{n}/live -> data: { trainNumber, trainName, startDate, lastUpdatedAt,
 *     status, isLive, trackingMode, delayMinutes, currentLocation: { stationCode,
 *     status ('at-station' | ...), isHalt, distanceFromOriginKm, distanceFromLastStationKm,
 *     speedKmh, delayMinutes }, route: [{ stationCode, distance, scheduledArrival,
 *     scheduledDeparture, actualArrival?, actualDeparture?, isHalt, status }] }
 *  GET /v1/trains/{n} -> data: { train: { number, name, runDays, source, destination },
 *     route: [{ sequence, station: { code, name, lat, lng }, arrival, arrivalDay,
 *     departure, departureDay, distance, isHalt }] }
 *
 * The documented live payload has no train latitude/longitude; position is
 * derived from distanceFromOriginKm. If a latitude/longitude pair is present
 * (undocumented) it is used only after validation.
 *
 * Nothing here invents data: missing values stay null and are reported in `issues`.
 */

const MAX_SPEED_KMH = 200;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const hhmm = (v) => (typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v) ? v.slice(0, 5).padStart(5, '0') : null);

function extractGps(loc, root) {
  const candidates = [
    [loc && loc.lat, loc && loc.lng],
    [loc && loc.latitude, loc && loc.longitude],
    [root && root.latitude, root && root.longitude],
    [root && root.lat, root && root.lng]
  ];
  for (const [la, lo] of candidates) {
    const lat = toNum(la); const lng = toNum(lo);
    if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0)) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * @param {object} body Full response body ({ success, data, meta }).
 * @param {{ trainNumber: string, receivedAt?: Date }} ctx
 */
function normalizeLiveStatus(body, ctx) {
  const receivedAt = ctx.receivedAt || new Date();
  const issues = [];
  if (!body || typeof body !== 'object') return { ok: false, issues: ['EMPTY_RESPONSE'] };
  if (body.success === false) return { ok: false, issues: ['API_REPORTED_FAILURE'] };
  const d = body.data;
  if (!d || typeof d !== 'object') return { ok: false, issues: ['MISSING_DATA'] };

  const trainNumber = String(d.trainNumber || (d.train && d.train.number) || '');
  if (ctx.trainNumber && trainNumber && trainNumber !== String(ctx.trainNumber)) {
    return { ok: false, issues: [`TRAIN_NUMBER_MISMATCH:${trainNumber}`] };
  }

  const loc = d.currentLocation || {};
  let observedAt = toDate(d.lastUpdatedAt) || toDate(body.meta && body.meta.timestamp);
  if (!observedAt) { observedAt = receivedAt; issues.push('NO_TIMESTAMP_USING_RECEIVED_AT'); }
  if (observedAt.getTime() > receivedAt.getTime() + 5 * 60000) {
    issues.push('TIMESTAMP_IN_FUTURE'); observedAt = receivedAt;
  }

  let speedKmh = toNum(loc.speedKmh);
  if (speedKmh !== null && (speedKmh < 0 || speedKmh > MAX_SPEED_KMH)) { issues.push('SPEED_OUT_OF_RANGE'); speedKmh = null; }

  let delayMinutes = toNum(d.delayMinutes);
  if (delayMinutes === null) delayMinutes = toNum(loc.delayMinutes);
  if (delayMinutes !== null && Math.abs(delayMinutes) > 24 * 60) { issues.push('DELAY_OUT_OF_RANGE'); delayMinutes = null; }

  let distanceFromOriginKm = toNum(loc.distanceFromOriginKm);
  if (distanceFromOriginKm !== null && distanceFromOriginKm < 0) { issues.push('NEGATIVE_DISTANCE'); distanceFromOriginKm = null; }

  const route = Array.isArray(d.route) ? d.route.map((r) => ({
    sequence: toNum(r.sequence),
    stationCode: String(r.stationCode || (r.station && r.station.code) || '').toUpperCase(),
    stationName: r.stationName || (r.station && r.station.name) || '',
    distanceKm: toNum(r.distance),
    isHalt: r.isHalt !== false,
    status: r.status || null,
    scheduledArrival: toDate(r.scheduledArrival),
    scheduledDeparture: toDate(r.scheduledDeparture),
    actualArrival: toDate(r.actualArrival),
    actualDeparture: toDate(r.actualDeparture),
    lat: toNum(r.lat ?? (r.station && r.station.lat)),
    lng: toNum(r.lng ?? (r.station && r.station.lng))
  })).filter((r) => r.stationCode) : [];

  const liveStatus = String(d.status || '').toLowerCase();
  const gps = extractGps(loc, d);
  const hasPosition = Boolean(gps) || distanceFromOriginKm !== null;
  if (!hasPosition) issues.push('NO_POSITION');

  return {
    ok: true,
    trainNumber: trainNumber || String(ctx.trainNumber),
    trainName: d.trainName || (d.train && d.train.name) || '',
    startDate: d.startDate || null,
    observedAt,
    receivedAt,
    isLive: d.isLive !== false,
    trackingMode: d.trackingMode || null,
    liveStatus,
    notStarted: ['not-started', 'not_started', 'scheduled', 'yet-to-start'].includes(liveStatus),
    completed: ['completed', 'reached', 'arrived-destination', 'terminated'].includes(liveStatus),
    cancelled: liveStatus === 'cancelled',
    speedKmh,
    delayMinutes,
    currentStationCode: String(loc.stationCode || '').toUpperCase(),
    currentStationName: loc.stationName || '',
    atStation: loc.status === 'at-station',
    distanceFromOriginKm,
    gps,
    route,
    issues
  };
}

/** Normalizes GET /v1/trains/{n} into a TrainSchedule-compatible object. */
function normalizeSchedule(body, ctx) {
  const d = body && body.data;
  if (!d || !Array.isArray(d.route) || d.route.length === 0) return null;
  const train = d.train || {};
  const stops = d.route.map((r) => ({
    stationCode: String((r.station && r.station.code) || r.stationCode || '').toUpperCase(),
    stationName: (r.station && r.station.name) || r.stationName || '',
    arrivalTime: hhmm(r.arrival),
    departureTime: hhmm(r.departure),
    dayOffset: Math.max(0, (toNum(r.departureDay ?? r.arrivalDay) || 1) - 1),
    distanceKm: toNum(r.distance),
    isHalt: r.isHalt !== false,
    lat: toNum(r.station && r.station.lat),
    lng: toNum(r.station && r.station.lng)
  })).filter((s) => s.stationCode);
  const runningDays = Array.isArray(train.runDays)
    ? train.runDays.map((x) => String(x).slice(0, 3).toUpperCase())
    : [];
  return {
    trainNumber: String(train.number || ctx.trainNumber),
    trainName: train.name || '',
    runningDays,
    stops,
    source: 'RAILRADAR_API',
    verified: true
  };
}

/** Extracts route stop distances from GET /v1/trains/{n}/route?stops=true. */
function normalizeRoute(body, ctx) {
  const d = body && body.data;
  if (!d) return null;
  const coords = d.geojson && d.geojson.geometry && Array.isArray(d.geojson.geometry.coordinates)
    ? d.geojson.geometry.coordinates.filter((c) => Array.isArray(c) && isNum(c[0]) && isNum(c[1]))
    : [];
  return {
    trainNumber: String(d.trainNumber || ctx.trainNumber),
    geometry: coords.length >= 2 ? { type: 'LineString', coordinates: coords } : undefined,
    stops: Array.isArray(d.stops) ? d.stops.map((s) => ({
      sequence: toNum(s.sequence),
      stationCode: String(s.code || '').toUpperCase(),
      stationName: s.name || '',
      lat: toNum(s.lat),
      lng: toNum(s.lng)
    })) : []
  };
}

module.exports = { normalizeLiveStatus, normalizeSchedule, normalizeRoute };
