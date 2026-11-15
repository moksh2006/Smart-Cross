/**
 * Adaptive live polling scheduler (LIVE mode only).
 *
 * For every monitored train the timetable decides WHEN to poll; RailRadar
 * decides WHERE the train is:
 *  - The train is tracked (timetable predictions) from LOOKAHEAD before its
 *    expected corridor entry until POST_CLEAR after expected exit.
 *  - Live polling starts PRE_POLL_MINUTES before expected entry (schedule + known
 *    delay) and stops POST_CLEAR_POLL_MINUTES after it leaves.
 *  - Poll interval shrinks as the train approaches a crossing (FAR -> MID -> NEAR).
 *  - A daily call budget derived from the remaining monthly quota is enforced;
 *    when it is spent only trains about to reach a crossing are polled.
 *  - One request at a time, no duplicates, local per-minute limiter in the client.
 */
const env = require('../../config/env');
const corridor = require('../../config/corridor');
const { MODE } = require('../../config/constants');
const { getSchedule, nearestCorridorTiming } = require('../railradar/trainScheduleService');
const { fetchLiveTrain } = require('../railradar/liveTrainService');
const { client } = require('../railradar/railRadarClient');
const historical = require('../prediction/historicalService');
const settings = require('../settings/settingsService');
const Train = require('../../models/Train');
const log = require('../../utils/logger')('scheduler');

class TrainPollingScheduler {
  constructor({ engine, alertService, clock = () => new Date(), fetchLive = fetchLiveTrain, apiClient = client } = {}) {
    this.engine = engine;
    this.alertService = alertService;
    this.clock = clock;
    this.fetchLive = fetchLive;
    this.client = apiClient;
    this.plans = new Map();
    this.timer = null;
    this.running = false;
    this.busy = false;
    this.lastTickAt = null;
  }

  start() {
    if (this.timer) return;
    this.running = true;
    this.timer = setInterval(() => this.tick().catch((e) => log.error(`tick failed: ${e.stack || e.message}`)), env.SCHEDULER_TICK_SECONDS * 1000);
    this.timer.unref?.();
    this.tick().catch((e) => log.error(`tick failed: ${e.message}`));
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  /** Builds/refreshes the per-train plan and registers relevant trains with the engine. */
  async refreshPlans(now) {
    const t = settings.thresholds();
    const monitored = settings.monitoredTrains();
    let scheduled = 0;
    for (const n of monitored) {
      const schedule = await getSchedule(n);
      if (!schedule) { this.plans.set(n, { trainNumber: n, error: 'NO_SCHEDULE' }); continue; }
      const timing = nearestCorridorTiming(schedule, now);
      if (!timing) { this.plans.set(n, { trainNumber: n, error: 'NO_CORRIDOR_TIMING' }); continue; }
      scheduled += 1;

      const engineTrain = this.engine.trains.get(n);
      const knownDelay = engineTrain && engineTrain.knownDelay;
      const delayMin = knownDelay && (now - knownDelay.observedAt) / 60000 <= t.RECENT_DELAY_VALIDITY_MINUTES ? knownDelay.minutes : 0;
      const delayMs = Math.max(0, delayMin) * 60000;
      const expectedEntry = new Date(timing.entryTime.getTime() + delayMs);
      const expectedExit = new Date(timing.exitTime.getTime() + delayMs);
      const pollStart = new Date(expectedEntry.getTime() - env.PRE_POLL_MINUTES * 60000);
      const pollEnd = new Date(expectedExit.getTime() + env.POST_CLEAR_POLL_MINUTES * 60000);
      const trackStart = new Date(expectedEntry.getTime() - t.PREDICTION_LOOKAHEAD_MINUTES * 60000);
      const prev = this.plans.get(n) || {};

      const plan = {
        ...prev,
        trainNumber: n,
        trainName: schedule.trainName,
        direction: timing.direction,
        scheduleSource: schedule.source,
        scheduleVerified: Boolean(schedule.verified),
        scheduledEntry: timing.entryTime,
        scheduledExit: timing.exitTime,
        expectedEntry,
        expectedExit,
        pollStart,
        pollEnd,
        error: null
      };
      this.plans.set(n, plan);

      const shouldTrack = now >= trackStart && now <= pollEnd;
      const live = engineTrain && engineTrain.lastObservation;
      const liveNearCorridor = live && Number.isFinite(live.chainage) &&
        live.chainage > -5000 && live.chainage < corridor.STATIONS.DBN.chainage + 5000 &&
        (now - live.observedAt) / 1000 < t.MAX_DEAD_RECKONING_SECONDS;

      if (shouldTrack || liveNearCorridor) {
        const hist = await historical.getTrainHistory(n);
        this.engine.upsertTrain(n, {
          trainName: schedule.trainName,
          direction: timing.direction,
          timing,
          historical: hist.perCrossing,
          historicalSpeedKmh: hist.avgSpeedKmh,
          meta: { scheduleSource: schedule.source, scheduleVerified: Boolean(schedule.verified) }
        });
      } else if (engineTrain && !engineTrain.finishedAt) {
        // outside every window and no live evidence: stop tracking
        this.engine.removeTrain(n);
      }
    }
    this.engine.coverage = { scheduledTrains: scheduled, monitoredTrains: monitored.length };
  }

  /** Desired polling interval for a plan (seconds) or null if not eligible. */
  intervalFor(plan, now) {
    if (!plan || plan.error) return null;
    const r = this.engine.lastTrainResults.get(plan.trainNumber);
    const engineTrain = this.engine.trains.get(plan.trainNumber);
    const inWindow = now >= plan.pollStart && now <= plan.pollEnd;
    const live = engineTrain && engineTrain.lastObservation && Number.isFinite(engineTrain.lastObservation.chainage);
    if (!inWindow && !(live && engineTrain && !engineTrain.finishedAt)) return null;
    if (plan.lastResult === 'NOT_STARTED' || plan.lastResult === 'CANCELLED') return 300;
    if (plan.lastResult === 'COMPLETED') return null;

    let eta = null;
    if (r) {
      const next = r.predictions.filter((p) => p.status === 'APPROACHING').sort((a, b) => a.etaSeconds - b.etaSeconds)[0];
      eta = next ? next.etaSeconds : null;
      if (r.predictions.every((p) => p.status === 'PASSED') && r.level <= 2) return null; // left corridor
    }
    let interval;
    if (eta === null || r.level > 2) interval = env.POLL_INTERVAL_FAR_SECONDS;
    else if (eta <= 5 * 60) interval = env.POLL_INTERVAL_NEAR_SECONDS;
    else if (eta <= 15 * 60) interval = env.POLL_INTERVAL_MID_SECONDS;
    else interval = env.POLL_INTERVAL_FAR_SECONDS;

    // Stretch intervals when the daily budget is getting tight.
    const st = this.client.status();
    if (st.dailyBudget > 0 && st.callsToday >= st.dailyBudget * 0.8) interval *= 3;
    plan.priorityEta = eta;
    return interval;
  }

  async tick() {
    if (!this.running || this.busy) return;
    if (this.engine.mode !== MODE.LIVE) return;
    this.busy = true;
    try {
      const now = this.clock();
      this.lastTickAt = now;
      await this.refreshPlans(now);
      if (!this.client.isConfigured()) return;

      const due = [];
      for (const plan of this.plans.values()) {
        const interval = this.intervalFor(plan, now);
        plan.intervalSeconds = interval;
        if (interval === null) { plan.nextPollAt = null; continue; }
        const last = plan.lastPolledAt ? plan.lastPolledAt.getTime() : 0;
        plan.nextPollAt = new Date(Math.max(now.getTime(), last + interval * 1000));
        if (now.getTime() - last >= interval * 1000) due.push(plan);
      }
      due.sort((a, b) => (a.priorityEta ?? 1e9) - (b.priorityEta ?? 1e9));

      const st = this.client.status();
      const overBudget = st.dailyBudget >= 0 && st.callsToday >= st.dailyBudget;
      for (const plan of due) {
        if (overBudget && !(plan.priorityEta !== null && plan.priorityEta !== undefined && plan.priorityEta <= 10 * 60)) {
          plan.lastResult = 'SKIPPED_BUDGET';
          continue;
        }
        const gate = this.client.canCallNow();
        if (!gate.ok) {
          plan.lastResult = `SKIPPED_${gate.reason}`;
          if (['QUOTA_EXHAUSTED', 'AUTH_FAILED'].includes(gate.reason)) await this.warn(gate.reason);
          break;
        }
        await this.pollTrain(plan);
      }
      if (overBudget) await this.warn('DAILY_BUDGET_SPENT');
    } finally {
      this.busy = false;
    }
  }

  async pollTrain(plan) {
    const engineTrain = this.engine.trains.get(plan.trainNumber);
    const timing = engineTrain && engineTrain.timing;
    plan.lastPolledAt = this.clock();
    const res = await this.fetchLive(plan.trainNumber, {
      kmPosts: timing ? { ptaKm: timing.ptaKm, dbnKm: timing.dbnKm } : {},
      purpose: 'LIVE_POLL'
    });
    if (this.engine.mode !== MODE.LIVE) return; // mode changed while waiting
    if (!res.ok) {
      plan.lastResult = res.errorCode || 'ERROR';
      plan.consecutiveErrors = (plan.consecutiveErrors || 0) + 1;
      if (res.errorCode === 'UNAUTHORIZED' || res.status === 401) await this.warn('AUTH_FAILED');
      return;
    }
    plan.consecutiveErrors = 0;
    const o = res.observation;
    plan.lastResult = o.cancelled ? 'CANCELLED' : o.notStarted ? 'NOT_STARTED' : o.completed ? 'COMPLETED' : (o.chainage === null ? 'NO_POSITION' : 'OK');
    plan.lastObservedAt = o.observedAt;
    if (!this.engine.trains.has(plan.trainNumber)) {
      this.engine.upsertTrain(plan.trainNumber, { trainName: o.trainName || plan.trainName, direction: plan.direction, timing });
    }
    const accepted = this.engine.ingestObservation(plan.trainNumber, {
      chainage: o.chainage,
      speedKmh: o.speedKmh,
      observedAt: o.observedAt,
      delayMinutes: o.delayMinutes,
      atStation: o.atStation,
      currentStationCode: o.currentStationCode,
      positionMethod: o.positionMethod,
      dataSource: 'LIVE_API'
    }, { mode: MODE.LIVE });
    plan.lastIngest = accepted.reason || 'ACCEPTED';
  }

  async warn(code) {
    if (!this.alertService) return;
    const messages = {
      QUOTA_EXHAUSTED: ['RailRadar quota exhausted', 'Live polling paused; predictions fall back to timetable and historical estimates.'],
      AUTH_FAILED: ['RailRadar authentication failed', 'Check RAILRADAR_API_KEY. Predictions fall back to timetable estimates.'],
      DAILY_BUDGET_SPENT: ['Daily API budget reached', 'Only trains about to reach a crossing are polled until tomorrow to preserve the monthly quota.']
    };
    const [title, message] = messages[code] || [code, code];
    await this.alertService.systemWarning({ mode: MODE.LIVE, code, title, message });
  }

  /** Manual refresh (admin): one immediate poll, still subject to quota. */
  async refreshNow(trainNumber) {
    const now = this.clock();
    await this.refreshPlans(now);
    const plan = this.plans.get(String(trainNumber)) || { trainNumber: String(trainNumber) };
    if (!this.engine.trains.has(plan.trainNumber)) {
      const schedule = await getSchedule(plan.trainNumber);
      const timing = schedule ? nearestCorridorTiming(schedule, now) : null;
      this.engine.upsertTrain(plan.trainNumber, { trainName: schedule ? schedule.trainName : '', direction: timing ? timing.direction : 'UNKNOWN', timing });
      plan.direction = timing ? timing.direction : 'UNKNOWN';
    }
    await this.pollTrain(plan);
    this.plans.set(plan.trainNumber, plan);
    await Train.updateOne({ trainNumber: plan.trainNumber }, { lastPolledAt: new Date() }).catch(() => {});
    return plan;
  }

  status() {
    const plans = [...this.plans.values()].map((p) => ({
      trainNumber: p.trainNumber,
      trainName: p.trainName,
      direction: p.direction,
      scheduleSource: p.scheduleSource,
      scheduleVerified: p.scheduleVerified,
      scheduledEntry: p.scheduledEntry,
      expectedEntry: p.expectedEntry,
      pollStart: p.pollStart,
      pollEnd: p.pollEnd,
      intervalSeconds: p.intervalSeconds ?? null,
      lastPolledAt: p.lastPolledAt || null,
      nextPollAt: p.nextPollAt || null,
      lastResult: p.lastResult || null,
      error: p.error || null
    })).sort((a, b) => new Date(a.expectedEntry || 0) - new Date(b.expectedEntry || 0));
    return { running: this.running && this.engine.mode === MODE.LIVE, lastTickAt: this.lastTickAt, plans };
  }
}

module.exports = { TrainPollingScheduler };
