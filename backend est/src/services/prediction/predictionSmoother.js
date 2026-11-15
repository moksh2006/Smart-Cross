/**
 * ETA smoothing with outlier rejection.
 *
 * For each (mode, train, crossing) we keep the previous smoothed ETA. The new
 * raw ETA is compared against the expected value (previous ETA minus elapsed
 * time). Small deviations are blended (EMA); large single jumps are treated as
 * outliers and only partially applied, unless the jump persists across
 * consecutive updates (a genuine change, e.g. train stopped) or the prediction
 * source changed, in which case the new value is adopted.
 */
class PredictionSmoother {
  constructor({ alpha = 0.4, outlierSeconds = 120, maxGapSeconds = 180 } = {}) {
    this.alpha = alpha;
    this.outlierSeconds = outlierSeconds;
    this.maxGapSeconds = maxGapSeconds;
    this.state = new Map();
  }

  key(mode, train, crossing) { return `${mode}:${train}:${crossing}`; }

  /**
   * @returns {{ etaSeconds: number, adjustedBy: number, outlier: boolean }}
   */
  smooth({ mode, trainNumber, phatakNumber, rawEtaSeconds, source, now = new Date() }) {
    const k = this.key(mode, trainNumber, phatakNumber);
    if (!Number.isFinite(rawEtaSeconds)) { this.state.delete(k); return { etaSeconds: rawEtaSeconds, adjustedBy: 0, outlier: false }; }
    if (rawEtaSeconds <= 0) { this.state.delete(k); return { etaSeconds: 0, adjustedBy: 0, outlier: false }; }

    const prev = this.state.get(k);
    const nowMs = now.getTime();
    if (!prev || prev.source !== source || (nowMs - prev.at) / 1000 > this.maxGapSeconds) {
      this.state.set(k, { eta: rawEtaSeconds, at: nowMs, source, pendingJumps: 0 });
      return { etaSeconds: rawEtaSeconds, adjustedBy: 0, outlier: false };
    }

    const expected = Math.max(0, prev.eta - (nowMs - prev.at) / 1000);
    const delta = rawEtaSeconds - expected;
    let next;
    let outlier = false;
    let pendingJumps = 0;

    if (Math.abs(delta) > this.outlierSeconds) {
      pendingJumps = prev.pendingJumps + 1;
      if (pendingJumps >= 2) {
        next = rawEtaSeconds; // persistent change: accept
        pendingJumps = 0;
      } else {
        outlier = true;
        next = expected + Math.sign(delta) * this.outlierSeconds * this.alpha;
      }
    } else {
      next = expected + this.alpha * delta;
    }
    // A train can never get closer faster than the raw estimate says when very near.
    if (rawEtaSeconds < 60) next = Math.min(next, rawEtaSeconds);
    next = Math.max(0, Math.round(next));
    this.state.set(k, { eta: next, at: nowMs, source, pendingJumps });
    return { etaSeconds: next, adjustedBy: next - rawEtaSeconds, outlier };
  }

  forgetTrain(mode, trainNumber) {
    for (const k of this.state.keys()) if (k.startsWith(`${mode}:${trainNumber}:`)) this.state.delete(k);
  }

  clearMode(mode) {
    for (const k of this.state.keys()) if (k.startsWith(`${mode}:`)) this.state.delete(k);
  }
}

module.exports = { PredictionSmoother };
