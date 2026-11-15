/**
 * Alert creation with duplicate suppression.
 * Alerts are produced only for genuine predicted-state transitions, new
 * grouped-closure advisories and system warnings. Identical alerts (same
 * dedupe key) are suppressed for ALERT_COOLDOWN_SECONDS.
 */
const Alert = require('../../models/Alert');
const { getCrossing, DIRECTIONS } = require('../../config/corridor');
const log = require('../../utils/logger')('alerts');

const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) : '—');

class AlertService {
  constructor({ emit = () => {}, now = () => new Date() } = {}) {
    this.emit = emit;
    this.now = now;
    this.recent = new Map(); // dedupeKey -> timestamp ms
  }

  setEmitter(fn) { this.emit = fn; }

  isDuplicate(key, cooldownSeconds) {
    const at = this.recent.get(key);
    const nowMs = this.now().getTime();
    if (at && nowMs - at < cooldownSeconds * 1000) return true;
    this.recent.set(key, nowMs);
    if (this.recent.size > 2000) {
      for (const [k, v] of this.recent) if (nowMs - v > 86400000) this.recent.delete(k);
    }
    return false;
  }

  clearMode(mode) {
    for (const k of this.recent.keys()) if (k.startsWith(`${mode}:`)) this.recent.delete(k);
  }

  async create(doc) {
    let saved = doc;
    try {
      saved = (await Alert.create(doc)).toObject();
    } catch (e) {
      log.warn(`Could not store alert: ${e.message}`);
      saved = { ...doc, _id: `${doc.dedupeKey}:${Date.now()}` };
    }
    this.emit(saved);
    return saved;
  }

  /** Alert for a gate state transition (transition from GateStateMachine.apply). */
  async onTransition(tr, { mode, prediction, cooldownSeconds }) {
    const c = getCrossing(tr.phatakNumber);
    const name = c ? `Phatak ${c.number} (${c.name})` : `Phatak ${tr.phatakNumber}`;
    const train = tr.trainNumber ? `Train ${tr.trainNumber}` : 'A train';
    const basis = tr.source ? ` Basis: ${tr.source.replace(/_/g, ' ').toLowerCase()}, ${String(tr.confidence || '').toLowerCase()} confidence.` : '';
    let severity; let title; let message;
    switch (tr.newStatus) {
      case 'CLOSING_SOON':
        severity = 'WARNING';
        title = `${name} expected to close soon`;
        message = `${train} expected at ${fmtTime(prediction && prediction.predictedArrival)}; closure predicted from ~${fmtTime(prediction && prediction.predictedClosureStart)}.${basis}`;
        break;
      case 'CLOSED':
        severity = 'CRITICAL';
        title = `${name} predicted closed`;
        message = `${tr.reason}. Estimated reopening ~${fmtTime(prediction && prediction.predictedReopen)}.${basis}`;
        break;
      case 'OPENING_SOON':
        severity = 'INFO';
        title = `${name} expected to reopen soon`;
        message = `${tr.reason}. Estimated reopening ~${fmtTime(prediction && prediction.predictedReopen)}.`;
        break;
      case 'OPEN':
        if (tr.previousStatus === 'UNKNOWN') return null; // initial evaluation, nothing to announce
        severity = 'SUCCESS';
        title = `${name} predicted open`;
        message = tr.previousStatus === 'CLOSING_SOON' ? `Closure no longer expected soon. ${tr.reason}.` : `${tr.reason}.`;
        break;
      case 'UNKNOWN':
        severity = 'WARNING';
        title = `${name}: prediction unavailable`;
        message = `${tr.reason}. Status cannot be predicted reliably.`;
        break;
      default:
        return null;
    }
    const dedupeKey = `${mode}:gate:${tr.phatakNumber}:${tr.newStatus}:${tr.trainNumber || '-'}`;
    if (this.isDuplicate(dedupeKey, cooldownSeconds)) return null;
    return this.create({
      mode, type: 'GATE_STATUS_CHANGE', severity, phatakNumbers: [tr.phatakNumber], trainNumber: tr.trainNumber,
      status: tr.newStatus, title, message, dedupeKey,
      meta: { previousStatus: tr.previousStatus, source: tr.source, confidence: tr.confidence }
    });
  }

  async onGroupedAdvisory(adv, { cooldownSeconds }) {
    const dedupeKey = `${adv.mode}:group:${adv.groupId}:${adv.trainNumber}`;
    if (this.isDuplicate(dedupeKey, cooldownSeconds)) return null;
    const dir = DIRECTIONS[adv.direction];
    return this.create({
      mode: adv.mode,
      type: 'GROUPED_CLOSURE',
      severity: 'WARNING',
      phatakNumbers: adv.sequence,
      trainNumber: adv.trainNumber,
      status: null,
      title: `${adv.groupName}: combined closure expected`,
      message: `${adv.message} Window ~${fmtTime(adv.windowStart)}–${fmtTime(adv.windowEnd)}${dir ? ` (${dir.label})` : ''}.`,
      dedupeKey,
      meta: { groupId: adv.groupId, sequence: adv.sequence, confidence: adv.confidence, overlap: adv.predictedWindowsOverlap }
    });
  }

  async systemWarning({ mode, code, title, message, severity = 'WARNING', cooldownSeconds = 1800 }) {
    const dedupeKey = `${mode}:system:${code}`;
    if (this.isDuplicate(dedupeKey, cooldownSeconds)) return null;
    return this.create({ mode, type: 'SYSTEM_WARNING', severity, phatakNumbers: [], title, message, dedupeKey, meta: { code } });
  }
}

module.exports = { AlertService };
