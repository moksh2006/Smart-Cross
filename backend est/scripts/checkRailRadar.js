#!/usr/bin/env node
/**
 * Verifies the RailRadar integration with YOUR API key (consumes 1 API call).
 * Fetches GET /v1/trains/{n}/live, prints the normalized observation, the
 * derived corridor position and any schema issues.
 * Usage: RAILRADAR_API_KEY=... npm run check-railradar -- 14508
 */
const env = require('../src/config/env');
const { client } = require('../src/services/railradar/railRadarClient');
const { normalizeLiveStatus } = require('../src/services/railradar/trainDataNormalizer');
const { resolveChainage } = require('../src/services/gis/positionResolver');
const { bundledSchedule, corridorTiming } = require('../src/services/railradar/trainScheduleService');
const { istDateString } = require('../src/utils/time');

(async () => {
  const n = process.argv[2] || '14508';
  if (!env.RAILRADAR_API_KEY) { console.error('RAILRADAR_API_KEY is not set'); process.exit(2); }
  client.audit = false;
  const res = await client.get(`/v1/trains/${encodeURIComponent(n)}/live`, { purpose: 'CHECK' });
  console.log('HTTP status:', res.status, res.ok ? 'OK' : res.errorCode);
  console.log('Quota:', JSON.stringify({ remaining: client.status().headerRemainingMonth, limit: client.status().headerLimitMonth }));
  if (!res.ok) process.exit(1);
  const norm = normalizeLiveStatus(res.data, { trainNumber: n });
  const sched = bundledSchedule(n);
  const timing = sched ? corridorTiming(sched, istDateString()) : null;
  const pos = norm.ok ? resolveChainage(norm, timing ? { ptaKm: timing.ptaKm, dbnKm: timing.dbnKm } : {}) : null;
  console.log('Normalized:', JSON.stringify({ ...norm, route: `${(norm.route || []).length} stops` }, null, 2));
  console.log('Position:', JSON.stringify(pos));
  console.log('Top-level data keys:', Object.keys((res.data && res.data.data) || {}).join(', '));
  console.log('currentLocation keys:', Object.keys((res.data && res.data.data && res.data.data.currentLocation) || {}).join(', '));
})();
