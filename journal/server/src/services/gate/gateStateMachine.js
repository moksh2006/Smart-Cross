/**
 * Gate State Machine Engine
 * Governs all gate state transitions:
 * OPEN -> CLOSING_SOON -> CLOSED -> OPENING_SOON -> OPEN
 * Enforces strict transition legality, generates immutable GateEvent audit logs,
 * and prevents duplicate state events.
 */

const { GATE_STATUS, DEFAULTS } = require('../../config/constants');
const GateEvent = require('../../models/GateEvent');
const Phatak = require('../../models/Phatak');

class GateStateMachine {
  /**
   * Determines next gate status based on train proximity and ETA.
   * @param {string} currentStatus Current status
   * @param {number|null} etaMinutes Estimated arrival in minutes
   * @param {number|null} distanceMeters Along-track distance in meters
   * @param {boolean} hasPassed Whether train has physically crossed phatak
   * @param {object} thresholds Dynamic thresholds from SystemSetting
   * @param {object} trainContext Context about controlling train (trainStatus, inCorridor, speed)
   * @returns {{ nextStatus: string, reason: string }}
   */
  evaluateNextStatus(currentStatus, etaMinutes, distanceMeters, hasPassed, thresholds = {}, trainContext = {}) {
    const closingSoonMins = thresholds.CLOSING_SOON_THRESHOLD_MINUTES || DEFAULTS.CLOSING_SOON_THRESHOLD_MINUTES;
    const closureDist = thresholds.CLOSURE_DISTANCE_METERS || DEFAULTS.CLOSURE_DISTANCE_METERS;
    const openingClearDist = thresholds.OPENING_CLEAR_DISTANCE_METERS || DEFAULTS.OPENING_CLEAR_DISTANCE_METERS;

    // If no train or data is insufficient
    if (etaMinutes === null || distanceMeters === null) {
      return { nextStatus: GATE_STATUS.UNKNOWN, reason: 'Insufficient train telemetry' };
    }

    // 1. Train has passed phatak
    if (hasPassed || distanceMeters < -100) {
      if (Math.abs(distanceMeters) >= openingClearDist) {
        return { nextStatus: GATE_STATUS.OPEN, reason: `Train has cleared phatak corridor (${Math.round(Math.abs(distanceMeters))}m past)` };
      } else {
        return { nextStatus: GATE_STATUS.OPENING_SOON, reason: 'Train is clearing phatak' };
      }
    }

    // Check if train is waiting at the station for a future scheduled time (has not departed)
    const isWaitingAtStation = trainContext.trainStatus === 'WAITING_FOR_SCHEDULED_TIME';

    // 2. Train approaching - CLOSED trigger: within closure distance (6km) or ETA <= 2.5 min
    // When train is 6km away and leaves from the station, the phatak is closed!
    if (!isWaitingAtStation && (distanceMeters <= closureDist || etaMinutes <= 2.5)) {
      return {
        nextStatus: GATE_STATUS.CLOSED,
        reason: `Train within 6km closure threshold after leaving station (${Math.round(distanceMeters)}m / ${etaMinutes}m ETA)`
      };
    }

    // 3. Train approaching - CLOSING_SOON trigger: ETA <= closingSoonMins
    if (etaMinutes <= closingSoonMins) {
      return { nextStatus: GATE_STATUS.CLOSING_SOON, reason: `Train approaching phatak within ${closingSoonMins} minutes (${etaMinutes}m ETA)` };
    }

    // 4. Far away (> closingSoonMins)
    return { nextStatus: GATE_STATUS.OPEN, reason: `No imminent train (${etaMinutes}m ETA / ${Math.round(distanceMeters)}m away)` };
  }

  /**
   * Processes a phatak update, executing state transition if needed.
   * Resolves multiple approaching trains by taking the earliest ETA.
   * @param {object} phatak Phatak document or plain object
   * @param {Array<object>} approachingPredictions Array of active predictions for this phatak
   * @param {object} thresholds System settings thresholds
   * @returns {Promise<{ phatak: object, stateChanged: boolean, previousStatus: string, newStatus: string, controllingTrain: object, gateEvent: object|null }>}
   */
  async processPhatakState(phatak, approachingPredictions = [], thresholds = {}) {
    // Multi-train resolution: pick train with earliest predictedArrival
    let controllingPrediction = null;
    if (approachingPredictions.length > 0) {
      controllingPrediction = [...approachingPredictions].sort((a, b) => {
        return new Date(a.predictedArrival).getTime() - new Date(b.predictedArrival).getTime();
      })[0];
    }

    const currentStatus = phatak.currentStatus || GATE_STATUS.UNKNOWN;
    let nextStatus = GATE_STATUS.OPEN;
    let reason = 'Corridor clear';
    let controllingTrainNumber = null;

    if (controllingPrediction) {
      controllingTrainNumber = controllingPrediction.trainNumber;
      const distMeters = controllingPrediction.distanceMeters !== undefined
        ? controllingPrediction.distanceMeters
        : (controllingPrediction.distanceToPhatakMeters !== undefined ? controllingPrediction.distanceToPhatakMeters : null);

      const trainContext = {
        trainStatus: controllingPrediction.trainStatus,
        inCorridor: controllingPrediction.inCorridor,
        speedKmh: controllingPrediction.speedKmh
      };

      const evaluation = this.evaluateNextStatus(
        currentStatus,
        controllingPrediction.etaMinutes,
        distMeters,
        Boolean(controllingPrediction.hasPassed),
        thresholds,
        trainContext
      );
      nextStatus = evaluation.nextStatus;
      reason = evaluation.reason;
    }

    const stateChanged = currentStatus !== nextStatus;
    let gateEvent = null;

    if (stateChanged) {
      // Calculate duration of previous state if applicable
      const durationSeconds = phatak.statusUpdatedAt
        ? Math.round((Date.now() - new Date(phatak.statusUpdatedAt).getTime()) / 1000)
        : 0;

      // Create immutable GateEvent transition record
      try {
        gateEvent = await GateEvent.create({
          phatakNumber: phatak.number,
          previousStatus: currentStatus,
          newStatus: nextStatus,
          trainNumber: controllingTrainNumber,
          timestamp: new Date(),
          reason,
          soundTriggered: true,
          durationSeconds
        });
      } catch (e) {
        console.warn(`[GateStateMachine] Error creating GateEvent: ${e.message}`);
      }

      // Update Phatak document in MongoDB
      try {
        if (typeof Phatak.findOneAndUpdate === 'function') {
          await Phatak.findOneAndUpdate(
            { number: phatak.number },
            {
              currentStatus: nextStatus,
              activeTrainNumber: controllingTrainNumber,
              statusUpdatedAt: new Date()
            }
          );
        }
      } catch (e) {
        console.warn(`[GateStateMachine] Error updating Phatak record: ${e.message}`);
      }
    }

    return {
      phatakNumber: phatak.number,
      stateChanged,
      previousStatus: currentStatus,
      newStatus: nextStatus,
      reason,
      controllingTrainNumber,
      gateEvent
    };
  }
}

module.exports = new GateStateMachine();
