/**
 * Gate state prediction.
 *
 * IMPORTANT: these states are SOFTWARE PREDICTIONS derived from train
 * position/timetable data. SmartCross has no gate sensors and never claims to
 * know the physical barrier position.
 *
 * Layer 1 — trainImpact(): what one train implies for one crossing.
 * Layer 2 — aggregateCrossing(): combine all trains for a crossing.
 * Layer 3 — GateStateMachine: per-crossing memory with hysteresis
 *           (downgrades must persist DOWNGRADE_CONFIRM_SECONDS) so the UI
 *           does not flap, and transition events for alerts/audit.
 */
const { GATE_STATUS, GATE_SEVERITY, CONFIDENCE_RANK } = require('../../config/constants');

const S = GATE_STATUS;

/**
 * @param {object} p crossing prediction from fallbackPredictor (+ smoothed etaSeconds)
 * @param {object} t thresholds
 * @returns {{ state: string, reason: string }}
 */
function trainImpact(p, t) {
  if (!p || p.status === 'UNKNOWN') return { state: S.UNKNOWN, reason: p ? p.reason || 'Insufficient data' : 'No prediction' };
  const eta = p.etaSeconds;
  const closingSoonS = t.CLOSING_SOON_THRESHOLD_MINUTES * 60;
  const closedEtaS = t.CLOSED_ETA_MINUTES * 60;
  const tn = `Train ${p.trainNumber}`;

  if (p.positional) {
    if (p.status === 'AT_CROSSING') return { state: S.CLOSED, reason: `${tn} predicted to be at the crossing` };
    if (p.status === 'PASSED') {
      return p.cleared
        ? { state: S.OPEN, reason: `${tn} has cleared the crossing` }
        : { state: S.OPENING_SOON, reason: `${tn} has passed; clearance pending` };
    }
    if (!p.stoppedNow && p.distanceMeters !== null && p.distanceMeters <= t.CLOSED_DISTANCE_METERS) {
      return { state: S.CLOSED, reason: `${tn} within ${p.distanceMeters} m (closure threshold ${t.CLOSED_DISTANCE_METERS} m)` };
    }
    if (eta <= closedEtaS) return { state: S.CLOSED, reason: `${tn} ETA ${Math.round(eta)} s (closure threshold ${t.CLOSED_ETA_MINUTES} min)` };
    if (eta <= closingSoonS) return { state: S.CLOSING_SOON, reason: `${tn} ETA ${Math.round(eta / 60)} min` };
    return { state: S.OPEN, reason: `${tn} ETA ${Math.round(eta / 60)} min` };
  }

  // Time-based predictions (timetable/historical) can warn but never assert CLOSED.
  if (p.status === 'PASSED') return { state: S.OPEN, reason: `${tn} expected to have passed (${p.source})` };
  if (p.status === 'DUE') return { state: S.CLOSING_SOON, reason: `${tn} due now per ${p.source} (unconfirmed, no live position)` };
  if (eta <= closingSoonS) return { state: S.CLOSING_SOON, reason: `${tn} expected in ~${Math.max(1, Math.round(eta / 60))} min (${p.source}, no live position)` };
  return { state: S.OPEN, reason: `${tn} expected in ~${Math.round(eta / 60)} min (${p.source})` };
}

/**
 * Combines the impacts of all relevant trains for one crossing.
 * @param {Array<{prediction: object, impact: {state, reason}}>} items
 * @returns {{ state, reason, controlling: object|null, contributors: object[] }}
 */
function aggregateCrossing(items, t) {
  const by = (state) => items.filter((i) => i.impact.state === state);
  const earliest = (list) => [...list].sort((a, b) => {
    const pa = a.prediction.positional ? 0 : 1; const pb = b.prediction.positional ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.prediction.etaSeconds ?? Infinity) - (b.prediction.etaSeconds ?? Infinity);
  })[0];

  const closed = by(S.CLOSED);
  if (closed.length) {
    const c = earliest(closed);
    const others = closed.length > 1 ? ` (+${closed.length - 1} more train${closed.length > 2 ? 's' : ''})` : '';
    return { state: S.CLOSED, reason: c.impact.reason + others, controlling: c.prediction, contributors: items };
  }

  const opening = by(S.OPENING_SOON);
  const closing = by(S.CLOSING_SOON);
  if (opening.length) {
    const clearing = opening.sort((a, b) => b.prediction.predictedReopen - a.prediction.predictedReopen)[0];
    const reopenAt = clearing.prediction.predictedReopen;
    const follower = items
      .filter((i) => i.prediction.positional && i.prediction.status === 'APPROACHING' && i.prediction.predictedClosureStart)
      .find((i) => i.prediction.predictedClosureStart.getTime() <= reopenAt.getTime() + t.BACK_TO_BACK_GAP_SECONDS * 1000);
    if (follower) {
      return {
        state: S.CLOSED,
        reason: `Train ${clearing.prediction.trainNumber} clearing but Train ${follower.prediction.trainNumber} follows closely; crossing expected to stay closed`,
        controlling: follower.prediction,
        contributors: items
      };
    }
    const next = closing.length ? `; next: ${earliest(closing).impact.reason}` : '';
    return { state: S.OPENING_SOON, reason: clearing.impact.reason + next, controlling: clearing.prediction, contributors: items };
  }

  if (closing.length) {
    const c = earliest(closing);
    return { state: S.CLOSING_SOON, reason: c.impact.reason, controlling: c.prediction, contributors: items };
  }

  const unknown = by(S.UNKNOWN);
  if (unknown.length) {
    return { state: S.UNKNOWN, reason: unknown[0].impact.reason, controlling: unknown[0].prediction, contributors: items };
  }

  const upcoming = items
    .filter((i) => i.prediction.status === 'APPROACHING')
    .sort((a, b) => a.prediction.etaSeconds - b.prediction.etaSeconds)[0];
  return {
    state: S.OPEN,
    reason: upcoming ? `No train within ${t.CLOSING_SOON_THRESHOLD_MINUTES} min (next: ${upcoming.impact.reason})` : 'No train predicted within the look-ahead window',
    controlling: upcoming ? upcoming.prediction : null,
    contributors: items
  };
}

/** Transitions that follow physical progression and are applied immediately. */
function isImmediate(from, to) {
  if (from === to) return true;
  if (from === S.UNKNOWN) return true;
  if (GATE_SEVERITY[to] > GATE_SEVERITY[from]) return true;          // escalation
  if (from === S.CLOSED && to === S.OPENING_SOON) return true;        // train passed
  if (from === S.OPENING_SOON && to === S.OPEN) return true;          // train cleared
  return false;                                                        // other downgrades need confirmation
}

class GateStateMachine {
  constructor() { this.crossings = new Map(); }

  reset(initial = {}) {
    this.crossings.clear();
    for (const [num, st] of Object.entries(initial)) {
      this.crossings.set(Number(num), { state: st.state || S.UNKNOWN, since: st.since || new Date(), pending: null });
    }
  }

  get(number) {
    return this.crossings.get(Number(number)) || { state: S.UNKNOWN, since: null, pending: null };
  }

  /**
   * Applies an aggregate result. Returns a transition object or null.
   */
  apply(number, aggregate, now, t) {
    const n = Number(number);
    const cur = this.crossings.get(n) || { state: S.UNKNOWN, since: now, pending: null };
    const target = aggregate.state;

    if (target === cur.state) {
      cur.pending = null;
      this.crossings.set(n, cur);
      return null;
    }

    if (!isImmediate(cur.state, target)) {
      if (!cur.pending || cur.pending.state !== target) {
        cur.pending = { state: target, since: now };
        this.crossings.set(n, cur);
        return null;
      }
      if ((now - cur.pending.since) / 1000 < t.DOWNGRADE_CONFIRM_SECONDS) {
        this.crossings.set(n, cur);
        return null;
      }
    }

    const transition = {
      phatakNumber: n,
      previousStatus: cur.state,
      newStatus: target,
      reason: aggregate.reason,
      trainNumber: aggregate.controlling ? aggregate.controlling.trainNumber : null,
      source: aggregate.controlling ? aggregate.controlling.source : null,
      confidence: aggregate.controlling ? aggregate.controlling.confidence : null,
      previousStateDurationSeconds: cur.since ? Math.round((now - cur.since) / 1000) : null,
      timestamp: now
    };
    this.crossings.set(n, { state: target, since: now, pending: null });
    return transition;
  }

  /** Effective displayed state (current, not pending). */
  snapshot() {
    const out = {};
    for (const [n, v] of this.crossings) out[n] = { state: v.state, since: v.since, pendingState: v.pending ? v.pending.state : null };
    return out;
  }
}

/** Lowest confidence among items (for combined statements). */
function minConfidence(list) {
  return list.reduce((acc, c) => (CONFIDENCE_RANK[c] < CONFIDENCE_RANK[acc] ? c : acc), 'HIGH');
}

module.exports = { trainImpact, aggregateCrossing, isImmediate, GateStateMachine, minConfidence };
