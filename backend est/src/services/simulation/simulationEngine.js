/**
 * Multi-train simulation engine.
 *
 * Each simulated train has kinematic state along the corridor chainage axis.
 * Every tick, its state is rendered as a RailRadar-format payload by the mock
 * provider, normalized, position-resolved and fed to the SAME CorridorEngine
 * used for live data. All simulated data is labelled SIMULATION.
 */
const env = require('../../config/env');
const corridor = require('../../config/corridor');
const { MODE } = require('../../config/constants');
const { buildLivePayload, kmPosts } = require('../railradar/mockRailRadarProvider');
const { normalizeLiveStatus } = require('../railradar/trainDataNormalizer');
const { resolveChainage } = require('../gis/positionResolver');
const bundled = require('../../data/bundledTimetable.json');
const log = require('../../utils/logger')('simulation');

const ACCEL_MPS2 = 0.4;
const DECEL_MPS2 = 0.8;
const MAX_TRAINS = 8;
const kmhToMps = (v) => (v * 1000) / 3600;

class SimValidationError extends Error {
  constructor(msg) { super(msg); this.status = 400; this.expose = true; }
}

const SCENARIOS = {
  'single-pta-dbn': {
    label: 'Single train Patiala → Dhablan',
    trains: [{ trainNumber: '14736', direction: 'PATIALA_TO_DHABLAN', speedKmh: 60, start: { type: 'BEFORE_ENTRY', meters: 3000 } }]
  },
  'single-dbn-pta': {
    label: 'Single train Dhablan → Patiala',
    trains: [{ trainNumber: '14508', direction: 'DHABLAN_TO_PATIALA', speedKmh: 60, start: { type: 'BEFORE_ENTRY', meters: 2000 } }]
  },
  'grouped-closure-b': {
    label: 'Grouped closure: Group B (23 & 24) then Group A',
    trains: [{ trainNumber: '54552', direction: 'DHABLAN_TO_PATIALA', speedKmh: 45, start: { type: 'CHAINAGE', meters: 7000 } }]
  },
  'opposing-trains': {
    label: 'Two trains in opposite directions',
    trains: [
      { trainNumber: '14736', direction: 'PATIALA_TO_DHABLAN', speedKmh: 55, start: { type: 'BEFORE_ENTRY', meters: 1500 } },
      { trainNumber: '14815', direction: 'DHABLAN_TO_PATIALA', speedKmh: 65, start: { type: 'CHAINAGE', meters: 9000 } }
    ]
  },
  'back-to-back': {
    label: 'Back-to-back trains (same direction)',
    trains: [
      { trainNumber: '54551', direction: 'PATIALA_TO_DHABLAN', speedKmh: 50, start: { type: 'BEFORE_ENTRY', meters: 1000 } },
      { trainNumber: '14816', direction: 'PATIALA_TO_DHABLAN', speedKmh: 70, start: { type: 'BEFORE_ENTRY', meters: 4500 } }
    ]
  },
  'delayed-departure': {
    label: 'Train held at Patiala (simulated 4 min delay)',
    trains: [{ trainNumber: '14507', direction: 'PATIALA_TO_DHABLAN', speedKmh: 50, holdMinutes: 4, delayMinutes: 4, start: { type: 'ENTRY_STATION' } }]
  },
  'gps-dropout': {
    label: 'Live position lost mid-corridor (dead reckoning)',
    trains: [{ trainNumber: '14526', direction: 'DHABLAN_TO_PATIALA', speedKmh: 55, start: { type: 'BEFORE_ENTRY', meters: 1000 }, signalLossAfterSeconds: 90 }]
  }
};

class SimulationEngine {
  constructor({ engine, clock = () => new Date() }) {
    this.engine = engine;
    this.clock = clock;
    this.trains = new Map();
    this.timer = null;
    this.startedAt = null;
    this.lastTickAt = null;
    this.idSeq = 0;
  }

  get running() { return Boolean(this.timer); }

  startChainage(direction, start = {}) {
    const ends = corridor.corridorEnds(direction);
    const sign = corridor.DIRECTIONS[direction].sign;
    switch (start.type) {
      case 'ENTRY_STATION': return ends.entry;
      case 'CHAINAGE': {
        const m = Number(start.meters);
        if (!Number.isFinite(m) || m < -15000 || m > corridor.STATIONS.DBN.chainage + 15000) throw new SimValidationError('start.meters (chainage) out of range');
        return m;
      }
      case 'BEFORE_CROSSING': {
        const c = corridor.getCrossing(start.phatakNumber);
        if (!c) throw new SimValidationError('Unknown phatakNumber for start position');
        const m = Number(start.meters ?? 2000);
        if (!Number.isFinite(m) || m < 0 || m > 15000) throw new SimValidationError('start.meters must be 0-15000');
        return c.chainage - sign * m;
      }
      case 'BEFORE_ENTRY':
      default: {
        const m = Number(start.meters ?? 3000);
        if (!Number.isFinite(m) || m < 0 || m > 15000) throw new SimValidationError('start.meters must be 0-15000');
        return ends.entry - sign * m;
      }
    }
  }

  validateSpec(spec) {
    if (!spec || typeof spec !== 'object') throw new SimValidationError('Train specification required');
    const dir = spec.direction;
    if (!corridor.DIRECTIONS[dir]) throw new SimValidationError('direction must be PATIALA_TO_DHABLAN or DHABLAN_TO_PATIALA');
    const speed = Number(spec.speedKmh ?? 50);
    if (!Number.isFinite(speed) || speed < 0 || speed > 130) throw new SimValidationError('speedKmh must be 0-130');
    const delay = Number(spec.delayMinutes ?? 0);
    if (!Number.isFinite(delay) || delay < -60 || delay > 600) throw new SimValidationError('delayMinutes must be -60..600');
    const hold = Number(spec.holdMinutes ?? 0);
    if (!Number.isFinite(hold) || hold < 0 || hold > 60) throw new SimValidationError('holdMinutes must be 0-60');
    const number = String(spec.trainNumber || '').trim() || `9${String(++this.idSeq).padStart(4, '0')}`;
    if (!/^[0-9A-Za-z\-_]{1,20}$/.test(number)) throw new SimValidationError('trainNumber must be 1-20 letters/digits');
    const loss = spec.signalLossAfterSeconds === undefined || spec.signalLossAfterSeconds === null ? null : Number(spec.signalLossAfterSeconds);
    if (loss !== null && (!Number.isFinite(loss) || loss < 0 || loss > 3600)) throw new SimValidationError('signalLossAfterSeconds must be 0-3600');
    return { number, dir, speed, delay, hold, loss };
  }

  /** Adds a simulated train. Switches the system to SIMULATION mode if needed. */
  async addTrain(spec) {
    if (this.trains.size >= MAX_TRAINS) throw new SimValidationError(`At most ${MAX_TRAINS} simulated trains`);
    const v = this.validateSpec(spec);
    const simNumber = `SIM-${v.number}`;
    if (this.trains.has(simNumber)) throw new SimValidationError(`${simNumber} is already running`);
    if (this.engine.mode !== MODE.SIMULATION) await this.engine.setMode(MODE.SIMULATION, { actor: 'simulation', reason: 'Simulation started' });

    const now = this.clock();
    const chainage = this.startChainage(v.dir, spec.start || {});
    const known = bundled.trains.find((t) => t.trainNumber === v.number);
    const name = spec.trainName || (known ? known.trainName : `Simulated train ${v.number}`);
    const sim = {
      id: simNumber,
      trainNumber: simNumber,
      baseTrainNumber: v.number,
      trainName: `${name} (simulated)`,
      direction: v.dir,
      chainage,
      speedKmh: v.hold > 0 ? 0 : v.speed,
      targetSpeedKmh: v.speed,
      holdUntil: v.hold > 0 ? new Date(now.getTime() + v.hold * 60000) : null,
      delayMinutes: v.delay,
      signalLossAt: v.loss !== null ? new Date(now.getTime() + v.loss * 1000) : null,
      signalLost: false,
      lastSignalAt: null,
      lastSignalChainage: chainage,
      lastSignalSpeed: v.speed,
      createdAt: now,
      finished: false
    };
    this.trains.set(simNumber, sim);

    // Synthetic timetable so fallback levels 3/5 can be exercised (labelled synthetic).
    const ends = corridor.corridorEnds(v.dir);
    const nominal = kmhToMps(Math.max(v.speed, 20));
    const toEntry = corridor.distanceAhead(chainage, ends.entry, v.dir);
    const entryTime = new Date(now.getTime() + (v.hold * 60 + Math.max(0, toEntry) / nominal - v.delay * 60) * 1000);
    const exitTime = new Date(entryTime.getTime() + (corridor.CORRIDOR_LENGTH_M / nominal) * 1000);
    const posts = kmPosts(v.dir);
    this.engine.upsertTrain(simNumber, {
      trainName: sim.trainName,
      direction: v.dir,
      isSimulated: true,
      timing: {
        direction: v.dir, synthetic: true, entryTime, exitTime, ptaKm: posts.ptaKm, dbnKm: posts.dbnKm,
        ptaDeparture: v.dir === 'PATIALA_TO_DHABLAN' ? entryTime : null,
        dbnDeparture: v.dir === 'DHABLAN_TO_PATIALA' ? entryTime : null,
        ptaArrival: null, dbnArrival: null, entryCode: corridor.DIRECTIONS[v.dir].from, exitCode: corridor.DIRECTIONS[v.dir].to
      },
      historical: {},
      meta: { scheduleSource: 'SIMULATION_SYNTHETIC' }
    });
    this.ensureTimer();
    this.publish(sim, now);
    log.info(`Added ${simNumber} ${v.dir} @${v.speed} km/h from chainage ${Math.round(chainage)} m`);
    return this.view(sim);
  }

  async startScenario(name) {
    const sc = SCENARIOS[name];
    if (!sc) throw new SimValidationError(`Unknown scenario ${name}`);
    await this.reset();
    const added = [];
    for (const spec of sc.trains) added.push(await this.addTrain(spec));
    return { scenario: name, label: sc.label, trains: added };
  }

  updateTrain(id, patch = {}) {
    const sim = this.trains.get(id);
    if (!sim) { const e = new SimValidationError(`Simulated train ${id} not found`); e.status = 404; throw e; }
    if (patch.speedKmh !== undefined) {
      const s = Number(patch.speedKmh);
      if (!Number.isFinite(s) || s < 0 || s > 130) throw new SimValidationError('speedKmh must be 0-130');
      sim.targetSpeedKmh = s;
      if (s > 0) sim.holdUntil = null;
    }
    if (patch.delayMinutes !== undefined) {
      const d = Number(patch.delayMinutes);
      if (!Number.isFinite(d) || d < -60 || d > 600) throw new SimValidationError('delayMinutes must be -60..600');
      sim.delayMinutes = d;
    }
    if (patch.signalLost !== undefined) {
      sim.signalLost = Boolean(patch.signalLost);
      sim.signalLossAt = null;
      if (sim.signalLost) { sim.lastSignalAt = this.clock(); sim.lastSignalChainage = sim.chainage; sim.lastSignalSpeed = sim.speedKmh; }
    }
    return this.view(sim);
  }

  removeTrain(id) {
    if (!this.trains.delete(id)) { const e = new SimValidationError(`Simulated train ${id} not found`); e.status = 404; throw e; }
    this.engine.removeTrain(id);
    if (!this.trains.size) this.stopTimer();
  }

  ensureTimer() {
    if (this.timer) return;
    this.startedAt = this.startedAt || this.clock();
    this.lastTickAt = this.clock();
    this.timer = setInterval(() => this.tick(), env.SIMULATION_TICK_MS);
    this.timer.unref?.();
  }

  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Pause movement (trains stay where they are, no new observations). */
  stop() { this.stopTimer(); }

  resume() { if (this.trains.size) this.ensureTimer(); }

  async reset() {
    this.stopTimer();
    for (const id of this.trains.keys()) this.engine.removeTrain(id);
    this.trains.clear();
    this.startedAt = null;
    if (this.engine.mode === MODE.SIMULATION) await this.engine.evaluate();
  }

  /** Advances all trains by elapsed wall-clock time. Exposed for tests. */
  tick(now = this.clock()) {
    const dt = Math.min(10, Math.max(0, (now - (this.lastTickAt || now)) / 1000));
    this.lastTickAt = now;
    if (this.engine.mode !== MODE.SIMULATION) { this.stopTimer(); return; }
    for (const sim of this.trains.values()) {
      this.advance(sim, dt, now);
      this.publish(sim, now);
    }
    for (const [id, sim] of this.trains) {
      if (sim.finished && now - sim.finishedAt > 60000) { this.trains.delete(id); }
    }
    if (!this.trains.size) this.stopTimer();
  }

  advance(sim, dt, now) {
    if (sim.holdUntil && now < sim.holdUntil) { sim.speedKmh = 0; return; }
    sim.holdUntil = null;
    const v = kmhToMps(sim.speedKmh);
    const target = kmhToMps(sim.targetSpeedKmh);
    let nv = v;
    if (target > v) nv = Math.min(target, v + ACCEL_MPS2 * dt);
    else if (target < v) nv = Math.max(target, v - DECEL_MPS2 * dt);
    const sign = corridor.DIRECTIONS[sim.direction].sign;
    sim.chainage += sign * ((v + nv) / 2) * dt;
    sim.speedKmh = (nv * 3600) / 1000;
    if (sim.signalLossAt && now >= sim.signalLossAt && !sim.signalLost) {
      sim.signalLost = true; sim.lastSignalAt = now; sim.lastSignalChainage = sim.chainage; sim.lastSignalSpeed = sim.speedKmh;
    }
    const exit = corridor.corridorEnds(sim.direction).exit;
    if (!sim.finished && corridor.distanceAhead(sim.chainage, exit, sim.direction) < -2500) {
      sim.finished = true; sim.finishedAt = now;
    }
  }

  /** Mock RailRadar payload -> normalizer -> resolver -> engine (same path as live). */
  publish(sim, now) {
    if (this.engine.mode !== MODE.SIMULATION || !this.engine.trains.has(sim.trainNumber)) return;
    const body = buildLivePayload(sim, now);
    const norm = normalizeLiveStatus(body, { trainNumber: sim.trainNumber, receivedAt: now });
    if (!norm.ok) return;
    const pos = resolveChainage(norm, kmPosts(sim.direction));
    this.engine.ingestObservation(sim.trainNumber, {
      chainage: pos.chainage,
      speedKmh: norm.speedKmh,
      observedAt: norm.observedAt,
      delayMinutes: norm.delayMinutes,
      atStation: norm.atStation,
      currentStationCode: norm.currentStationCode,
      positionMethod: pos.method,
      dataSource: 'SIMULATION'
    }, { mode: MODE.SIMULATION });
  }

  view(sim) {
    return {
      id: sim.id,
      trainNumber: sim.trainNumber,
      baseTrainNumber: sim.baseTrainNumber,
      trainName: sim.trainName,
      direction: sim.direction,
      chainage: Math.round(sim.chainage),
      coordinates: corridor.pointAtChainage(sim.chainage),
      speedKmh: Math.round(sim.speedKmh * 10) / 10,
      targetSpeedKmh: sim.targetSpeedKmh,
      delayMinutes: sim.delayMinutes,
      holding: Boolean(sim.holdUntil && this.clock() < sim.holdUntil),
      holdUntil: sim.holdUntil,
      signalLost: sim.signalLost,
      finished: sim.finished,
      isSimulated: true
    };
  }

  status() {
    return {
      mode: this.engine.mode,
      running: this.running,
      startedAt: this.startedAt,
      trains: [...this.trains.values()].map((s) => this.view(s)),
      scenarios: Object.entries(SCENARIOS).map(([id, s]) => ({ id, label: s.label })),
      trainCatalog: bundled.trains.map((t) => ({ trainNumber: t.trainNumber, trainName: t.trainName, direction: t.corridorDirection })),
      maxTrains: MAX_TRAINS
    };
  }
}

module.exports = { SimulationEngine, SCENARIOS, SimValidationError };
