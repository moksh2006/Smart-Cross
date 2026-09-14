/**
 * Alert Deduplication Engine
 * Strictly prevents spamming by ensuring alerts fire ONLY on genuine status transitions.
 */

class AlertDeduplicator {
  constructor() {
    this.lastAlertedStatus = new Map(); // key: phatakNumber -> status
    this.lastAlertTime = new Map();     // key: phatakNumber -> timestamp
  }

  /**
   * Checks if an alert should be emitted for a phatak status change.
   * @param {number} phatakNumber
   * @param {string} newStatus
   * @returns {boolean} True if genuine state transition, false if duplicate
   */
  shouldEmitAlert(phatakNumber, newStatus) {
    if (!this.lastAlertedStatus.has(phatakNumber)) {
      this.lastAlertedStatus.set(phatakNumber, newStatus);
      this.lastAlertTime.set(phatakNumber, Date.now());
      return true; // First observation
    }

    const previousStatus = this.lastAlertedStatus.get(phatakNumber);

    if (previousStatus === newStatus) {
      return false; // DUPLICATE - suppress!
    }

    // Status has changed: record and allow
    this.lastAlertedStatus.set(phatakNumber, newStatus);
    this.lastAlertTime.set(phatakNumber, Date.now());
    return true;
  }

  reset(phatakNumber = null) {
    if (phatakNumber !== null) {
      this.lastAlertedStatus.delete(phatakNumber);
      this.lastAlertTime.delete(phatakNumber);
    } else {
      this.lastAlertedStatus.clear();
      this.lastAlertTime.clear();
    }
  }
}

module.exports = new AlertDeduplicator();
