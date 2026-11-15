/**
 * Grouped crossing advisories.
 *
 * When one train is predicted to affect two or more crossings of the same
 * group (Group A: 19 & 20, Group B: 23 & 24) within the warning horizon, a
 * combined advisory is produced with the predicted closure SEQUENCE and each
 * crossing's own estimated closure/reopen window.
 *
 * This module never changes gate states and never assumes the barriers of a
 * group close simultaneously — it only reports whether the predicted windows
 * overlap.
 */
const { GROUPS, DIRECTIONS } = require('../../config/corridor');
const { minConfidence } = require('./gateStateMachine');

const ACTIVE_STATES = new Set(['CLOSING_SOON', 'CLOSED', 'OPENING_SOON']);

/**
 * @param {Map<number, Array<{prediction, impact}>>} itemsByCrossing
 * @param {object} t thresholds
 * @returns {object[]} advisories
 */
function detectGroupedClosures(itemsByCrossing, t) {
  const advisories = [];
  const horizon = t.CLOSING_SOON_THRESHOLD_MINUTES * 60;

  for (const group of GROUPS) {
    const perTrain = new Map();
    for (const num of group.crossings) {
      for (const item of itemsByCrossing.get(num) || []) {
        const p = item.prediction;
        if (!p || p.status === 'UNKNOWN') continue;
        const relevant = ACTIVE_STATES.has(item.impact.state) ||
          (p.status === 'APPROACHING' && p.etaSeconds !== null && p.etaSeconds <= horizon + 5 * 60);
        if (!relevant || (p.status === 'PASSED' && p.cleared)) continue;
        if (!perTrain.has(p.trainNumber)) perTrain.set(p.trainNumber, []);
        perTrain.get(p.trainNumber).push({ number: num, prediction: p, impact: item.impact });
      }
    }

    for (const [trainNumber, entries] of perTrain) {
      if (entries.length < 2) continue;
      if (!entries.some((e) => ACTIVE_STATES.has(e.impact.state))) continue; // nothing imminent yet
      entries.sort((a, b) => a.prediction.predictedArrival - b.prediction.predictedArrival);
      const windows = entries.map((e) => ({
        phatakNumber: e.number,
        predictedState: e.impact.state,
        etaSeconds: e.prediction.etaSeconds,
        predictedArrival: e.prediction.predictedArrival,
        predictedClosureStart: e.prediction.predictedClosureStart,
        predictedReopen: e.prediction.predictedReopen,
        closureDurationSeconds: e.prediction.closureDurationSeconds,
        confidence: e.prediction.confidence,
        source: e.prediction.source
      }));
      const overlap = windows.slice(1).every((w, i) => w.predictedClosureStart <= windows[i].predictedReopen);
      const gapSeconds = Math.round((windows[windows.length - 1].predictedArrival - windows[0].predictedArrival) / 1000);
      const p0 = entries[0].prediction;
      const dir = DIRECTIONS[p0.direction];
      const seq = windows.map((w) => w.phatakNumber).join(' → ');
      advisories.push({
        id: `${group.id}:${trainNumber}`,
        groupId: group.id,
        groupName: group.name,
        trainNumber,
        trainName: p0.trainName,
        direction: p0.direction,
        sequence: windows.map((w) => w.phatakNumber),
        crossings: windows,
        windowStart: new Date(Math.min(...windows.map((w) => w.predictedClosureStart))),
        windowEnd: new Date(Math.max(...windows.map((w) => w.predictedReopen))),
        predictedWindowsOverlap: overlap,
        arrivalGapSeconds: gapSeconds,
        confidence: minConfidence(windows.map((w) => w.confidence)),
        source: p0.source,
        mode: p0.mode,
        message: `Train ${trainNumber}${dir ? ` (${dir.short})` : ''} is predicted to affect Phataks ${seq} in sequence ` +
          `(~${Math.max(1, Math.round(gapSeconds / 60))} min apart). ` +
          (overlap ? 'Predicted closure windows overlap; ' : 'Predicted closure windows do not overlap; ') +
          'actual barrier timings may differ.'
      });
    }
  }
  return advisories;
}

module.exports = { detectGroupedClosures };
