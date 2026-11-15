/**
 * Corridor engine — the single evaluation loop used by BOTH live and
 * simulation modes:
 *
 *   observations / timetable  ->  fallbackPredictor (5 levels)  ->  smoothing
 *   ->  trainImpact per crossing  ->  aggregateCrossing  ->  GateStateMachine
 *   ->  grouped advisories  ->  alerts / GateEvents / persistence  ->  Socket.IO
 *
 * Live and simulation data never mix: the engine holds trains for exactly one
 * mode at a time; switching mode clears all train state and resets crossings
 * to UNKNOWN. Every record written carries its mode.
 */
const env = require('../../config/env');
const corridor = require('../../config/corridor');
const { SOCKET_EVENTS, GATE_STATUS, MODE } = require('../../config/constants');
const { predictTrain } = require('../prediction/fallbackPredictor');
const { PredictionSmoother } = require('../prediction/predictionSmoother');
const { trainImpact, aggregateCrossing, GateStateMachine } = require('../gate/gateStateMachine');
const { detectGroupedClosures } = require('../gate/groupedClosureDetector');
const historical = require('../prediction/historicalService');
const settings = require('../settings/settingsService');
const { istDateString } = require('../../utils/time');
const log = require('../../utils/logger')('engine');

const PERSIST_INTERVAL_MS = 30000;
const FINISHED_GRACE_MS = 60000;

class CorridorEngine {
  constructor({ clock = () => new Date(), persist = true, alertService = null } = {}) {
    this.clock = clock;
    this.persist = persist;
    this.alertService = alertService;
    this.emitter = null;
    this.models = persist ? require('../../models') : null; // eslint-disable-line global-require
    this.mode = MODE.SIMULATION;
    this.runId = this.newRunId();
    this.trains = new Map();
    this.smoother = new PredictionSmoother();
    this.gsm = new GateStateMachine();
    this.aggregates = new Map();
    this.advisories = [];
    this.lastTrainResults = new Map();
    this.passageMemo = new Set();
    this.horizonMemo = new Set();
    this.persistMemo = new Map();
    this.seq = 0;
    this.lastEvaluatedAt = null;
    this.timer = null;
    this.evaluating = null;
    this.pendingEvaluate = false;
    this.feedStatus = () => ({});
    this.coverage = { scheduledTrains: 0 };
    this.gsm.reset();
  }

  newRunId() { return Math.random().toString(36).slice(2, 8); }

  setEmitter(emitter) { this.emitter = emitter; }
  setFeedStatusProvider(fn) { this.feedStatus = fn; }
  emit(event, payload) { if (this.emitter) this.emitter.emit(event, payload); }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.evaluate().catch((e) => log.error(`evaluate failed: ${e.stack || e.message}`)), env.ENGINE_TICK_SECONDS * 1000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Switch between LIVE and SIMULATION. Clears all train state. */
  async setMode(mode, { actor = 'system', reason = '' } = {}) {
    if (![MODE.LIVE, MODE.SIMULATION].includes(mode)) throw new Error(`Invalid mode ${mode}`);
    const previous = this.mode;
    this.mode = mode;
    this.runId = this.newRunId();
    this.trains.clear();
    this.lastTrainResults.clear();
    this.smoother = new PredictionSmoother();
    this.gsm.reset();
    this.aggregates.clear();
    this.advisories = [];
    this.persistMemo.clear();
    if (this.persist && previous !== mode) {
      await this.models.PhatakPrediction.updateMany({ mode: previous }, { isActive: false }).catch(() => {});
      await this.models.AuditLog.create({ category: 'ADMIN_ACTION', action: 'SET_MODE', actor, details: { from: previous, to: mode, reason } }).catch(() => {});
    }
    log.info(`Mode set to ${mode}${reason ? ` (${reason})` : ''}`);
    await this.evaluate();
    this.emit(SOCKET_EVENTS.SYSTEM_STATUS, this.systemStatus());
  }

  /** Create or update a tracked train (metadata, timetable, history). */
  upsertTrain(trainNumber, patch = {}) {
    const n = String(trainNumber);
    const cur = this.trains.get(n) || {
      trainNumber: n,
      trainName: '',
      mode: this.mode,
      direction: 'UNKNOWN',
      lastObservation: null,
      recentSpeeds: [],
      historicalSpeedKmh: null,
      timing: null,
      knownDelay: null,
      historical: {},
      outlierStreak: 0,
      reverseStreak: 0,
      lastStatuses: {},
      finishedAt: null,
      isSimulated: this.mode === MODE.SIMULATION,
      meta: {}
    };
    Object.assign(cur, patch, { mode: this.mode });
    this.trains.set(n, cur);
    return cur;
  }

  removeTrain(trainNumber) {
    const n = String(trainNumber);
    this.trains.delete(n);
    this.lastTrainResults.delete(n);
    this.smoother.forgetTrain(this.mode, n);
    if (this.persist) {
      this.models.PhatakPrediction.updateMany({ mode: this.mode, trainNumber: n }, { isActive: false }).catch(() => {});
    }
  }

  /**
   * Accepts an observation for a tracked train after validation and outlier rejection.
   * @param {object} o { chainage|null, speedKmh, observedAt: Date, delayMinutes, atStation,
   *   currentStationCode, positionMethod, dataSource ('LIVE_API'|'SIMULATION') }
   */
  ingestObservation(trainNumber, o, { mode = this.mode } = {}) {
    if (mode !== this.mode) return { accepted: false, reason: 'MODE_MISMATCH' };
    const train = this.trains.get(String(trainNumber));
    if (!train) return { accepted: false, reason: 'UNKNOWN_TRAIN' };
    if (!(o.observedAt instanceof Date) || Number.isNaN(o.observedAt.getTime())) return { accepted: false, reason: 'INVALID_TIMESTAMP' };
    const t = settings.thresholds();

    if (Number.isFinite(o.delayMinutes)) train.knownDelay = { minutes: o.delayMinutes, observedAt: o.observedAt };

    const prev = train.lastObservation;
    if (prev && o.observedAt <= prev.observedAt) return { accepted: false, reason: 'NOT_NEWER' };

    if (!Number.isFinite(o.chainage)) {
      // Delay/speed information without a position: keep last position, record speed.
      if (Number.isFinite(o.speedKmh)) this.pushSpeed(train, o.speedKmh);
      return { accepted: false, reason: 'NO_POSITION' };
    }

    if (prev && Number.isFinite(prev.chainage) && corridor.DIRECTIONS[train.direction]) {
      const dt = (o.observedAt - prev.observedAt) / 1000;
      const ds = (o.chainage - prev.chainage) * corridor.DIRECTIONS[train.direction].sign;
      const implied = dt > 0 ? Math.abs(ds) / dt * 3.6 : Infinity;
      if (Math.abs(ds) > 500 && implied > t.MAX_TRAIN_SPEED_KMH * 1.5) {
        train.outlierStreak += 1;
        if (train.outlierStreak < 3) {
          log.warn(`Outlier rejected for ${train.trainNumber}: jump ${Math.round(ds)} m in ${Math.round(dt)} s`);
          return { accepted: false, reason: 'OUTLIER' };
        }
      }
      if (ds < -200) {
        train.reverseStreak += 1;
        if (train.reverseStreak >= 2) {
          const flipped = train.direction === 'PATIALA_TO_DHABLAN' ? 'DHABLAN_TO_PATIALA' : 'PATIALA_TO_DHABLAN';
          log.warn(`Train ${train.trainNumber} moving opposite to expected direction; switching to ${flipped}`);
          train.direction = flipped;
          train.reverseStreak = 0;
          train.lastStatuses = {};
          this.smoother.forgetTrain(this.mode, train.trainNumber);
        } else {
          return { accepted: false, reason: 'REVERSE_MOVEMENT_UNCONFIRMED' };
        }
      } else {
        train.reverseStreak = 0;
      }
    }
    train.outlierStreak = 0;
    if (Number.isFinite(o.speedKmh)) this.pushSpeed(train, o.speedKmh);
    train.lastObservation = { ...o };
    this.scheduleEvaluate();
    return { accepted: true };
  }

  pushSpeed(train, v) {
    train.recentSpeeds.push(v);
    if (train.recentSpeeds.length > 5) train.recentSpeeds.shift();
  }

  /** Coalesces bursts of observations into one evaluation. */
  scheduleEvaluate() {
    if (this.pendingEvaluate) return;
    this.pendingEvaluate = true;
    setImmediate(() => {
      this.pendingEvaluate = false;
      this.evaluate().catch((e) => log.error(`evaluate failed: ${e.message}`));
    });
  }

  serviceKey(date) {
    const d = istDateString(date);
    return this.mode === MODE.LIVE ? d : `${d}#${this.runId}`;
  }

  /** Runs one full evaluation. Concurrent calls share the in-progress run. */
  async evaluate() {
    if (this.evaluating) { this.rerunRequested = true; return this.evaluating; }
    this.evaluating = this._evaluate().finally(() => {
      this.evaluating = null;
      if (this.rerunRequested) { this.rerunRequested = false; this.scheduleEvaluate(); }
    });
    return this.evaluating;
  }

  async _evaluate() {
    const now = this.clock();
    const t = settings.thresholds();
    const itemsByCrossing = new Map(corridor.CROSSINGS.map((c) => [c.number, []]));
    const toRemove = [];
    const sideEffects = [];

    for (const train of this.trains.values()) {
      const r = predictTrain(train, now, t);
      for (const p of r.predictions) {
        if (p.status === 'APPROACHING' && Number.isFinite(p.etaSeconds)) {
          const s = this.smoother.smooth({ mode: this.mode, trainNumber: train.trainNumber, phatakNumber: p.phatakNumber, rawEtaSeconds: p.etaSeconds, source: p.source, now });
          if (s.adjustedBy) {
            const shift = s.adjustedBy * 1000;
            p.rawEtaSeconds = p.etaSeconds;
            p.etaSeconds = s.etaSeconds;
            p.predictedArrival = new Date(p.predictedArrival.getTime() + shift);
            p.predictedClosureStart = new Date(p.predictedClosureStart.getTime() + shift);
            p.predictedReopen = new Date(p.predictedReopen.getTime() + shift);
          }
        }
        p.isSimulated = this.mode === MODE.SIMULATION;
        let impact = trainImpact(p, t);
        if (p.status === 'APPROACHING' && p.etaSeconds > t.PREDICTION_LOOKAHEAD_MINUTES * 60) {
          impact = { state: GATE_STATUS.OPEN, reason: `Train ${p.trainNumber} beyond look-ahead window` };
        }
        p.impact = impact.state;
        itemsByCrossing.get(p.phatakNumber)?.push({ prediction: p, impact });
        sideEffects.push(...this.trackPassageAndHorizons(train, p, t, now));
      }
      this.lastTrainResults.set(train.trainNumber, r);
      if (this.isFinished(train, r, now, t)) {
        if (!train.finishedAt) train.finishedAt = now;
        else if (now - train.finishedAt > FINISHED_GRACE_MS) toRemove.push(train.trainNumber);
      } else {
        train.finishedAt = null;
      }
    }

    const transitions = [];
    for (const c of corridor.CROSSINGS) {
      const items = itemsByCrossing.get(c.number);
      let agg;
      if (items.length) {
        agg = aggregateCrossing(items, t);
      } else if (this.mode === MODE.LIVE && this.coverage.scheduledTrains === 0) {
        agg = { state: GATE_STATUS.UNKNOWN, reason: 'No timetable or live data available', controlling: null, contributors: [] };
      } else {
        agg = {
          state: GATE_STATUS.OPEN,
          reason: this.mode === MODE.SIMULATION
            ? 'No simulated train approaching'
            : `No monitored train expected within ${t.PREDICTION_LOOKAHEAD_MINUTES} min`,
          controlling: null,
          contributors: []
        };
      }
      this.aggregates.set(c.number, agg);
      const tr = this.gsm.apply(c.number, agg, now, t);
      if (tr) transitions.push({ tr, agg });
    }

    const advisories = detectGroupedClosures(itemsByCrossing, t);
    const newAdvisories = advisories.filter((a) => !this.advisories.some((b) => b.id === a.id));
    this.advisories = advisories;

    for (const n of toRemove) this.removeTrain(n);
    this.lastEvaluatedAt = now;
    this.seq += 1;

    for (const { tr, agg } of transitions) await this.handleTransition(tr, agg, t);
    for (const adv of newAdvisories) {
      if (this.alertService) await this.alertService.onGroupedAdvisory(adv, { cooldownSeconds: t.ALERT_COOLDOWN_SECONDS });
    }
    if (this.persist) {
      await Promise.all(sideEffects.map((fn) => fn().catch((e) => log.warn(e.message))));
      await this.persistPredictions(now);
    }

    this.emit(SOCKET_EVENTS.SNAPSHOT, this.snapshot());
    return { transitions: transitions.map((x) => x.tr), advisories };
  }

  isFinished(train, r, now, t) {
    if (!r.predictions.length) return false;
    const allCleared = r.predictions.every((p) => p.status === 'PASSED' && (p.cleared || !p.positional));
    if (!allCleared) return false;
    if (train.isSimulated) return true;
    if (train.timing) return now - train.timing.exitTime > env.POST_CLEAR_POLL_MINUTES * 60000 || r.level <= 2;
    return true;
  }

  /** Records observed passages and prediction samples (returns deferred DB ops). */
  trackPassageAndHorizons(train, p, t, now) {
    const ops = [];
    const key = `${train.trainNumber}:${p.phatakNumber}`;
    const prevStatus = train.lastStatuses[p.phatakNumber];
    train.lastStatuses[p.phatakNumber] = p.status;

    if (p.positional && (p.status === 'AT_CROSSING' || p.status === 'PASSED') && prevStatus === 'APPROACHING' &&
        p.dataAgeSeconds !== null && p.dataAgeSeconds <= t.STALE_DATA_THRESHOLD_SECONDS) {
      const sk = this.serviceKey(p.predictedArrival);
      const memo = `${this.mode}:${sk}:${key}`;
      if (!this.passageMemo.has(memo)) {
        this.passageMemo.add(memo);
        const obs = train.lastObservation || {};
        ops.push(() => historical.recordPassage({
          mode: this.mode,
          serviceDate: sk,
          trainNumber: train.trainNumber,
          phatakNumber: p.phatakNumber,
          direction: train.direction,
          observedArrival: p.predictedArrival,
          speedKmh: Number.isFinite(obs.speedKmh) ? obs.speedKmh : p.effectiveSpeedKmh,
          delayMinutes: train.knownDelay ? train.knownDelay.minutes : null,
          scheduledEntryTime: train.timing && !train.timing.synthetic ? train.timing.entryTime : null,
          closureSeconds: p.closureDurationSeconds
        }));
      }
    }

    if (p.status === 'APPROACHING' && Number.isFinite(p.etaSeconds) && p.source !== 'UNKNOWN') {
      for (const h of historical.HORIZONS_MIN) {
        if (p.etaSeconds <= h * 60 && p.etaSeconds > h * 60 - 90) {
          const sk = this.serviceKey(p.predictedArrival);
          const memo = `${this.mode}:${sk}:${key}:${h}`;
          if (this.horizonMemo.has(memo)) continue;
          this.horizonMemo.add(memo);
          ops.push(() => historical.logPrediction({
            mode: this.mode, serviceDate: sk, trainNumber: train.trainNumber, phatakNumber: p.phatakNumber,
            horizonMinutes: h, source: p.source, confidence: p.confidence, predictedArrival: p.predictedArrival
          }));
        }
      }
    }
    if (this.passageMemo.size > 5000) this.passageMemo.clear();
    if (this.horizonMemo.size > 20000) this.horizonMemo.clear();
    return ops;
  }

  async handleTransition(tr, agg, t) {
    const payload = { ...tr, mode: this.mode, isPrediction: true };
    if (this.persist) {
      try {
        await this.models.GateEvent.create({
          mode: this.mode,
          phatakNumber: tr.phatakNumber,
          previousStatus: tr.previousStatus,
          newStatus: tr.newStatus,
          trainNumber: tr.trainNumber,
          source: tr.source,
          confidence: tr.confidence,
          reason: tr.reason,
          previousStateDurationSeconds: tr.previousStateDurationSeconds,
          timestamp: tr.timestamp
        });
        await this.models.Phatak.updateOne({ number: tr.phatakNumber }, {
          currentStatus: tr.newStatus,
          statusMode: this.mode,
          statusReason: tr.reason,
          activeTrainNumber: tr.trainNumber,
          statusUpdatedAt: tr.timestamp
        });
      } catch (e) {
        log.warn(`Persisting transition failed: ${e.message}`);
      }
    }
    this.emit(SOCKET_EVENTS.GATE_STATUS_CHANGE, payload);
    if (this.alertService) {
      await this.alertService.onTransition(tr, { mode: this.mode, prediction: agg.controlling, cooldownSeconds: t.ALERT_COOLDOWN_SECONDS });
    }
  }

  async persistPredictions(now) {
    const ops = [];
    for (const [trainNumber, r] of this.lastTrainResults) {
      for (const p of r.predictions) {
        if (p.status === 'UNKNOWN' && !p.predictedArrival) continue;
        const k = `${trainNumber}:${p.phatakNumber}`;
        const last = this.persistMemo.get(k);
        const changed = !last || last.status !== p.status || Math.abs((last.eta ?? 0) - (p.etaSeconds ?? 0)) > 30 || now - last.at > PERSIST_INTERVAL_MS;
        if (!changed) continue;
        this.persistMemo.set(k, { status: p.status, eta: p.etaSeconds, at: now });
        ops.push({
          updateOne: {
            filter: { mode: this.mode, trainNumber, phatakNumber: p.phatakNumber },
            update: {
              $set: {
                trainName: p.trainName || '',
                direction: corridor.DIRECTIONS[p.direction] ? p.direction : 'UNKNOWN',
                source: p.source,
                confidence: p.confidence,
                status: p.status,
                distanceMeters: p.distanceMeters,
                etaSeconds: p.etaSeconds,
                predictedArrival: p.predictedArrival,
                predictedClosureStart: p.predictedClosureStart,
                predictedReopen: p.predictedReopen,
                closureDurationSeconds: p.closureDurationSeconds,
                effectiveSpeedKmh: p.effectiveSpeedKmh,
                dataAgeSeconds: p.dataAgeSeconds,
                isActive: !(p.status === 'PASSED' && p.cleared),
                calculatedAt: now
              }
            },
            upsert: true
          }
        });
      }
    }
    if (ops.length) await this.models.PhatakPrediction.bulkWrite(ops, { ordered: false }).catch((e) => log.warn(`bulkWrite: ${e.message}`));
  }

  // ---------------------------------------------------------------- views

  predictionView(p) {
    return {
      trainNumber: p.trainNumber,
      trainName: p.trainName,
      direction: p.direction,
      phatakNumber: p.phatakNumber,
      status: p.status,
      impact: p.impact,
      source: p.source,
      level: p.level,
      confidence: p.confidence,
      distanceMeters: p.distanceMeters,
      etaSeconds: p.etaSeconds,
      predictedArrival: p.predictedArrival,
      predictedClosureStart: p.predictedClosureStart,
      predictedReopen: p.predictedReopen,
      closureDurationSeconds: p.closureDurationSeconds,
      effectiveSpeedKmh: p.effectiveSpeedKmh,
      dataAgeSeconds: p.dataAgeSeconds,
      dataSource: p.dataSource,
      isSimulated: p.isSimulated,
      calculatedAt: p.calculatedAt
    };
  }

  crossingView(c) {
    const agg = this.aggregates.get(c.number);
    const st = this.gsm.get(c.number);
    const preds = (agg ? agg.contributors : [])
      .map((i) => this.predictionView(i.prediction))
      .filter((p) => !(p.status === 'PASSED' && p.impact === 'OPEN'))
      .sort((a, b) => (a.etaSeconds ?? 1e9) - (b.etaSeconds ?? 1e9));
    const controlling = agg && agg.controlling ? this.predictionView(agg.controlling) : null;
    return {
      number: c.number,
      name: c.name,
      coordinates: c.coordinates,
      group: c.group,
      chainageMeters: c.chainage,
      state: st.state,
      stateSince: st.since,
      pendingState: st.pendingState || null,
      reason: agg ? agg.reason : 'Not evaluated yet',
      controlling,
      predictions: preds,
      isPrediction: true,
      mode: this.mode
    };
  }

  trainView(train) {
    const r = this.lastTrainResults.get(train.trainNumber);
    const t = settings.thresholds();
    const obs = train.lastObservation;
    const positional = r && Number.isFinite(r.positionChainage);
    const next = r ? r.predictions.filter((p) => p.status === 'APPROACHING').sort((a, b) => a.etaSeconds - b.etaSeconds)[0] : null;
    let corridorStatus = 'UNKNOWN';
    if (positional && corridor.DIRECTIONS[train.direction]) {
      const ends = corridor.corridorEnds(train.direction);
      const toEntry = corridor.distanceAhead(r.positionChainage, ends.entry, train.direction);
      const toExit = corridor.distanceAhead(r.positionChainage, ends.exit, train.direction);
      corridorStatus = toEntry > 0 ? 'APPROACHING_CORRIDOR' : toExit >= 0 ? 'IN_CORRIDOR' : 'LEFT_CORRIDOR';
    } else if (train.timing) {
      const delayMs = train.knownDelay ? train.knownDelay.minutes * 60000 : 0;
      const now = this.clock();
      corridorStatus = now < train.timing.entryTime.getTime() + delayMs ? 'SCHEDULED'
        : now <= train.timing.exitTime.getTime() + delayMs ? 'EXPECTED_IN_CORRIDOR' : 'EXPECTED_DEPARTED';
    }
    return {
      trainNumber: train.trainNumber,
      trainName: train.trainName,
      direction: train.direction,
      mode: this.mode,
      isSimulated: train.isSimulated,
      source: r ? r.source : 'UNKNOWN',
      level: r ? r.level : 6,
      confidence: r ? r.confidence : 'NONE',
      reason: r ? r.reason : 'Not evaluated yet',
      positionChainage: positional ? r.positionChainage : null,
      coordinates: positional ? corridor.pointAtChainage(r.positionChainage) : null,
      heading: positional && corridor.DIRECTIONS[train.direction] ? Math.round(corridor.headingAtChainage(r.positionChainage, train.direction)) : null,
      measuredSpeedKmh: obs && Number.isFinite(obs.speedKmh) ? obs.speedKmh : null,
      effectiveSpeedKmh: r ? r.effectiveSpeedKmh : null,
      stopped: r ? Boolean(r.stopped) : false,
      delayMinutes: train.knownDelay ? train.knownDelay.minutes : null,
      dataAgeSeconds: r ? r.dataAgeSeconds : null,
      isStale: obs ? (this.clock() - obs.observedAt) / 1000 > t.STALE_DATA_THRESHOLD_SECONDS : true,
      observedAt: obs ? obs.observedAt : null,
      positionMethod: obs ? obs.positionMethod : null,
      dataSource: obs ? obs.dataSource : (train.timing ? 'TIMETABLE' : 'NONE'),
      corridorStatus,
      nextCrossing: next ? { phatakNumber: next.phatakNumber, etaSeconds: next.etaSeconds, distanceMeters: next.distanceMeters, predictedArrival: next.predictedArrival } : null,
      scheduledEntry: train.timing ? train.timing.entryTime : null,
      scheduledExit: train.timing ? train.timing.exitTime : null,
      scheduleSource: train.meta.scheduleSource || (train.isSimulated ? 'SIMULATION' : null),
      currentStation: obs ? obs.currentStationCode || null : null
    };
  }

  snapshot() {
    return {
      seq: this.seq,
      mode: this.mode,
      generatedAt: this.lastEvaluatedAt || this.clock(),
      crossings: corridor.CROSSINGS.map((c) => this.crossingView(c)),
      trains: [...this.trains.values()].map((tr) => this.trainView(tr)),
      groups: this.advisories,
      system: this.systemStatus()
    };
  }

  systemStatus() {
    return {
      mode: this.mode,
      liveAvailable: Boolean(env.RAILRADAR_API_KEY),
      lastEvaluatedAt: this.lastEvaluatedAt,
      trackedTrains: this.trains.size,
      coverage: this.coverage,
      feed: this.feedStatus(),
      disclaimer: 'Crossing states are software predictions from train data, not physical gate sensor readings. ' +
        'Only monitored passenger trains are covered; unscheduled/freight trains are not predicted.'
    };
  }
}

module.exports = { CorridorEngine };
