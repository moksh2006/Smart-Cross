/**
 * Timetable access and corridor timing.
 *
 * Source priority: in-memory cache -> MongoDB TrainSchedule -> RailRadar
 * /v1/trains/{n} (only when FETCH_SCHEDULES_FROM_API=true, to protect quota)
 * -> bundled fallback timetable (unverified, labelled as such).
 */
const env = require('../../config/env');
const TrainSchedule = require('../../models/TrainSchedule');
const bundled = require('../../data/bundledTimetable.json');
const { client } = require('./railRadarClient');
const { normalizeSchedule } = require('./trainDataNormalizer');
const { istTimeOnDate, istDateString, istDayName, addDays } = require('../../utils/time');
const log = require('../../utils/logger')('schedule');

const memo = new Map();

function bundledSchedule(trainNumber) {
  const s = bundled.trains.find((t) => t.trainNumber === String(trainNumber));
  return s ? { ...s, source: 'BUNDLED_SEED', verified: false } : null;
}

function inferDirection(stops) {
  const p = stops.findIndex((s) => s.stationCode === 'PTA');
  const d = stops.findIndex((s) => s.stationCode === 'DBN');
  if (p === -1 || d === -1) return 'UNKNOWN';
  return p < d ? 'PATIALA_TO_DHABLAN' : 'DHABLAN_TO_PATIALA';
}

async function getSchedule(trainNumber) {
  const key = String(trainNumber);
  if (memo.has(key)) return memo.get(key);

  let schedule = null;
  try {
    schedule = await TrainSchedule.findOne({ trainNumber: key }).lean();
  } catch (e) {
    log.warn(`DB read failed for schedule ${key}: ${e.message}`);
  }

  const stale = !schedule || (Date.now() - new Date(schedule.fetchedAt).getTime()) > env.SCHEDULE_REFRESH_DAYS * 86400000;
  if (env.FETCH_SCHEDULES_FROM_API && client.isConfigured() && (stale || schedule.source !== 'RAILRADAR_API')) {
    const res = await client.get(`/v1/trains/${encodeURIComponent(key)}`, { cacheTtlMs: 3600000, trainNumber: key, purpose: 'SCHEDULE' });
    const norm = res.ok ? normalizeSchedule(res.data, { trainNumber: key }) : null;
    if (norm && norm.stops.length) {
      norm.corridorDirection = inferDirection(norm.stops);
      norm.fetchedAt = new Date();
      try {
        schedule = await TrainSchedule.findOneAndUpdate({ trainNumber: key }, norm, { upsert: true, new: true, runValidators: true }).lean();
      } catch (e) {
        log.warn(`Could not store schedule ${key}: ${e.message}`);
        schedule = norm;
      }
    }
  }

  if (!schedule) schedule = bundledSchedule(key);
  if (schedule && (!schedule.corridorDirection || schedule.corridorDirection === 'UNKNOWN')) {
    schedule.corridorDirection = inferDirection(schedule.stops || []);
  }
  if (schedule) memo.set(key, schedule);
  return schedule;
}

function clearCache(trainNumber) {
  if (trainNumber) memo.delete(String(trainNumber)); else memo.clear();
}

/**
 * Scheduled corridor timing for the journey that started on `journeyStartDate`.
 * @returns {null | { direction, journeyStartDate, entryCode, exitCode, entryTime: Date,
 *   exitTime: Date, ptaKm, dbnKm, ptaArrival: Date|null, ptaDeparture: Date|null,
 *   dbnArrival: Date|null, dbnDeparture: Date|null, runsOnDate: boolean }}
 */
function corridorTiming(schedule, journeyStartDate) {
  if (!schedule || !Array.isArray(schedule.stops)) return null;
  const pta = schedule.stops.find((s) => s.stationCode === 'PTA');
  const dbn = schedule.stops.find((s) => s.stationCode === 'DBN');
  if (!pta || !dbn) return null;
  const direction = schedule.corridorDirection && schedule.corridorDirection !== 'UNKNOWN'
    ? schedule.corridorDirection : inferDirection(schedule.stops);

  const t = (stop, which) => {
    const hh = which === 'arr' ? (stop.arrivalTime || stop.departureTime) : (stop.departureTime || stop.arrivalTime);
    return istTimeOnDate(journeyStartDate, hh, stop.dayOffset || 0);
  };
  const ptaArrival = pta.arrivalTime ? istTimeOnDate(journeyStartDate, pta.arrivalTime, pta.dayOffset || 0) : null;
  const ptaDeparture = pta.departureTime ? istTimeOnDate(journeyStartDate, pta.departureTime, pta.dayOffset || 0) : null;
  const dbnArrival = dbn.arrivalTime ? istTimeOnDate(journeyStartDate, dbn.arrivalTime, dbn.dayOffset || 0) : null;
  const dbnDeparture = dbn.departureTime ? istTimeOnDate(journeyStartDate, dbn.departureTime, dbn.dayOffset || 0) : null;

  const isPtaToDbn = direction === 'PATIALA_TO_DHABLAN';
  let entryTime = isPtaToDbn ? t(pta, 'dep') : t(dbn, 'dep');
  let exitTime = isPtaToDbn ? t(dbn, 'arr') : t(pta, 'arr');
  if (!entryTime || !exitTime) return null;
  // Guard against midnight wrap inside the corridor when dayOffset is missing.
  if (exitTime < entryTime) exitTime = new Date(exitTime.getTime() + 86400000);
  if (exitTime - entryTime > 3 * 3600000) return null; // implausible corridor transit

  const runningDays = schedule.runningDays && schedule.runningDays.length ? schedule.runningDays : null;
  const runsOnDate = !runningDays || runningDays.includes(istDayName(istTimeOnDate(journeyStartDate, '12:00')));

  return {
    direction,
    journeyStartDate,
    entryCode: isPtaToDbn ? 'PTA' : 'DBN',
    exitCode: isPtaToDbn ? 'DBN' : 'PTA',
    entryTime,
    exitTime,
    ptaKm: pta.distanceKm ?? null,
    dbnKm: dbn.distanceKm ?? null,
    ptaArrival,
    ptaDeparture,
    dbnArrival,
    dbnDeparture,
    runsOnDate
  };
}

/**
 * The corridor passage nearest to `now` among journeys started yesterday,
 * today or the day before (to handle multi-day trains), restricted to running days.
 */
function nearestCorridorTiming(schedule, now = new Date()) {
  if (!schedule) return null;
  const today = istDateString(now);
  const maxOffset = Math.max(0, ...(schedule.stops || []).map((s) => s.dayOffset || 0));
  const candidates = [];
  for (let back = -1; back <= maxOffset + 1; back++) {
    const ct = corridorTiming(schedule, addDays(today, -back));
    if (ct && ct.runsOnDate) candidates.push(ct);
  }
  if (!candidates.length) return null;
  const distance = (ct) => {
    if (now < ct.entryTime) return ct.entryTime - now;
    if (now > ct.exitTime) return now - ct.exitTime;
    return 0;
  };
  candidates.sort((a, b) => distance(a) - distance(b));
  return candidates[0];
}

module.exports = { getSchedule, clearCache, corridorTiming, nearestCorridorTiming, inferDirection, bundledSchedule };
