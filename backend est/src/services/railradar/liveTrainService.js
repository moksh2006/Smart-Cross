/**
 * Live train provider backed by RailRadar GET /v1/trains/{n}/live.
 * Returns normalized observations with corridor chainage, persists snapshots,
 * and updates the Train document. Never fabricates data: failures return
 * { ok: false } and the prediction engine falls back to lower levels.
 */
const { client } = require('./railRadarClient');
const { normalizeLiveStatus } = require('./trainDataNormalizer');
const { resolveChainage } = require('../gis/positionResolver');
const { pointAtChainage } = require('../../config/corridor');
const Train = require('../../models/Train');
const TrainLiveSnapshot = require('../../models/TrainLiveSnapshot');
const TrainRoute = require('../../models/TrainRoute');
const log = require('../../utils/logger')('live');

const LIVE_CACHE_MS = 20000; // never ask for the same train twice within 20 s

/**
 * @param {string} trainNumber
 * @param {{ kmPosts?: {ptaKm, dbnKm}, purpose?: string, persist?: boolean }} opts
 * @returns {Promise<{ ok: boolean, errorCode?: string, observation?: object }>}
 */
async function fetchLiveTrain(trainNumber, opts = {}) {
  const n = String(trainNumber);
  if (!/^[0-9A-Za-z\-_/ ]{1,20}$/.test(n)) return { ok: false, errorCode: 'INVALID_TRAIN_NUMBER' };

  const res = await client.get(`/v1/trains/${encodeURIComponent(n)}/live`, {
    cacheTtlMs: LIVE_CACHE_MS, trainNumber: n, purpose: opts.purpose || 'LIVE_STATUS'
  });
  const persist = opts.persist !== false;
  if (!res.ok) {
    if (persist) Train.updateOne({ trainNumber: n }, { lastPolledAt: new Date(), lastPollError: res.errorCode }).catch(() => {});
    return { ok: false, errorCode: res.errorCode, status: res.status };
  }

  const norm = normalizeLiveStatus(res.data, { trainNumber: n, receivedAt: new Date() });
  if (!norm.ok) {
    if (persist) Train.updateOne({ trainNumber: n }, { lastPolledAt: new Date(), lastPollError: norm.issues.join(',') }).catch(() => {});
    return { ok: false, errorCode: 'INVALID_PAYLOAD', issues: norm.issues };
  }

  const pos = resolveChainage(norm, opts.kmPosts || {});
  const observation = {
    ...norm,
    dataSource: 'LIVE_API',
    chainage: pos.chainage,
    positionMethod: pos.method,
    coordinates: pos.chainage !== null ? pointAtChainage(pos.chainage) : null,
    issues: norm.issues.concat(pos.issues),
    fromCache: res.fromCache
  };

  if (persist && !res.fromCache) await persistObservation(n, observation, res.data);
  return { ok: true, observation };
}

async function persistObservation(trainNumber, o, raw) {
  try {
    await Train.updateOne({ trainNumber }, {
      $set: {
        trainName: o.trainName || undefined,
        currentLocation: o.coordinates ? { type: 'Point', coordinates: o.coordinates } : null,
        chainageMeters: o.chainage,
        speedKmh: o.speedKmh,
        delayMinutes: o.delayMinutes,
        delayObservedAt: o.delayMinutes !== null ? o.observedAt : undefined,
        currentStation: o.currentStationCode,
        liveStatus: o.liveStatus,
        lastObservedAt: o.observedAt,
        lastPolledAt: new Date(),
        lastPollError: o.issues.length ? o.issues.join(',') : null
      }
    }, { upsert: true });
    await TrainLiveSnapshot.updateOne(
      { trainNumber, observedAt: o.observedAt },
      {
        $setOnInsert: {
          trainNumber,
          observedAt: o.observedAt,
          receivedAt: o.receivedAt,
          location: o.coordinates ? { type: 'Point', coordinates: o.coordinates } : undefined,
          chainageMeters: o.chainage,
          positionMethod: o.positionMethod,
          speedKmh: o.speedKmh,
          delayMinutes: o.delayMinutes,
          currentStation: o.currentStationCode,
          atStation: o.atStation,
          liveStatus: o.liveStatus,
          rawPayload: raw
        }
      },
      { upsert: true }
    );
    if (o.route.length) {
      await TrainRoute.updateOne({ trainNumber }, {
        $set: {
          stops: o.route.map((r) => ({ sequence: r.sequence, stationCode: r.stationCode, stationName: r.stationName, distanceKm: r.distanceKm, lat: r.lat, lng: r.lng })),
          source: 'RAILRADAR_LIVE_ROUTE',
          fetchedAt: new Date()
        }
      }, { upsert: true });
    }
  } catch (e) {
    log.warn(`Persisting observation for ${trainNumber} failed: ${e.message}`);
  }
}

module.exports = { fetchLiveTrain };
