const Alert = require('../../models/Alert');
const alertDeduplicator = require('./alertDeduplicator');
const { GATE_STATUS, ALERT_SEVERITY, ALERT_TYPE } = require('../../config/constants');

class AlertService {
  /**
   * Generates a deduplicated alert for a phatak status change.
   */
  async handleStatusChangeAlert({ phatakNumber, previousStatus, newStatus, trainNumber }) {
    // 1. Check deduplication
    if (!alertDeduplicator.shouldEmitAlert(phatakNumber, newStatus)) {
      return null; // Duplicate suppressed
    }

    // 2. Determine severity, sound trigger, and user message
    let severity = ALERT_SEVERITY.INFO;
    let message = `Phatak ${phatakNumber} status changed to ${newStatus}`;
    let soundTrigger = false;

    switch (newStatus) {
      case GATE_STATUS.CLOSING_SOON:
        severity = ALERT_SEVERITY.WARNING;
        message = `⚠️ Phatak ${phatakNumber} is closing soon. Train ${trainNumber || ''} is approaching.`;
        soundTrigger = true;
        break;
      case GATE_STATUS.CLOSED:
        severity = ALERT_SEVERITY.CRITICAL;
        message = `🚨 Phatak ${phatakNumber} is now CLOSED! Level crossing is blocked.`;
        soundTrigger = true;
        break;
      case GATE_STATUS.OPENING_SOON:
        severity = ALERT_SEVERITY.INFO;
        message = `🔔 Phatak ${phatakNumber} is opening soon. Train has cleared.`;
        soundTrigger = true;
        break;
      case GATE_STATUS.OPEN:
        severity = ALERT_SEVERITY.SUCCESS;
        message = `✅ Phatak ${phatakNumber} is now OPEN. Safe to cross.`;
        soundTrigger = true;
        break;
      default:
        severity = ALERT_SEVERITY.INFO;
        message = `ℹ️ Phatak ${phatakNumber} status is ${newStatus}.`;
        soundTrigger = false;
    }

    const startTime = Date.now();

    // 3. Persist alert in MongoDB
    let alertDoc = null;
    try {
      alertDoc = await Alert.create({
        phatakNumber,
        trainNumber,
        type: ALERT_TYPE.GATE_STATUS_CHANGE,
        severity,
        message,
        soundTrigger,
        deliveredAt: new Date(),
        latencyMs: Date.now() - startTime
      });
    } catch (e) {
      console.warn(`[AlertService] Alert DB save warning: ${e.message}`);
    }

    return {
      phatakNumber,
      trainNumber,
      previousStatus,
      newStatus,
      severity,
      message,
      soundTrigger,
      timestamp: new Date(),
      alertId: alertDoc ? alertDoc._id : null
    };
  }
}

module.exports = new AlertService();
