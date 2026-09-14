/**
 * SmartCross Complete Pipeline Orchestrator
 * Connects RailRadar live observations -> GIS route projection ->
 * Train-to-Phatak sequence & distance -> ETA prediction ->
 * Gate State Machine -> GateEvent & Alert creation -> Socket.IO real-time broadcast.
 */

const Train = require('../models/Train');
const Phatak = require('../models/Phatak');
const TrainPhatakMapping = require('../models/TrainPhatakMapping');
const PhatakPrediction = require('../models/PhatakPrediction');
const GateEvent = require('../models/GateEvent');
const Alert = require('../models/Alert');
const SystemSetting = require('../models/SystemSetting');

const { mapTrainToPhataks } = require('./gis/mappingEngine');
const fallbackPredictor = require('./prediction/fallbackPredictor');
const predictionSmoother = require('./prediction/predictionSmoother');
const gateStateMachine = require('./gate/gateStateMachine');
const alertService = require('./alert/alertService');
const socketManager = require('./websocket/socketManager');
const liveTrainService = require('./railradar/liveTrainService');
const trainRouteService = require('./railradar/trainRouteService');
const trainScheduleService = require('./railradar/trainScheduleService');
const scheduleTrackingEngine = require('./prediction/scheduleTrackingEngine');
const { getTrackGeometry } = require('./gis/routeGeometryProcessor');
const { DEFAULTS, CONFIDENCE, DIRECTION } = require('../config/constants');

class PipelineOrchestrator {
  /**
   * Retrieves active system thresholds from MongoDB SystemSettings.
   */
  async getThresholds() {
    const thresholds = { ...DEFAULTS };
    try {
      const settings = await SystemSetting.find();
      settings.forEach(s => {
        if (s.key && s.value !== undefined) {
          thresholds[s.key] = s.value;
        }
      });
      // Migrate legacy 1200 threshold in database to 6000
      if (thresholds.CLOSURE_DISTANCE_METERS < 6000) {
        thresholds.CLOSURE_DISTANCE_METERS = 6000;
        await SystemSetting.findOneAndUpdate(
          { key: 'CLOSURE_DISTANCE_METERS' },
          { value: 6000 },
          { upsert: true }
        );
      }
    } catch (e) {
      // Fallback to defaults
    }
    return thresholds;
  }

  /**
   * Processes a single train's update through the complete pipeline.
   * If live API is unavailable or has no coordinates, falls back to scheduled timetable progression.
   * @param {string} trainNumber Train number
   * @param {object|null} liveData Optional already-normalized live data
   * @param {object} options Optional flags (referenceTime, forcedProgress)
   * @returns {Promise<object>} Diagnostic and processing summary
   */
  async processTrainUpdate(trainNumber, liveData = null, options = {}) {
    const startTime = Date.now();
    const trainNo = String(trainNumber);

    const result = {
      trainNumber: trainNo,
      steps: {
        timetable: false,
        route: false,
        liveStatus: false,
        normalization: false,
        mongodb: false,
        mapping: false,
        prediction: false,
        gateStateMachine: false,
        socketBroadcast: false
      },
      liveData: null,
      mappings: [],
      predictions: [],
      gateTransitions: [],
      alerts: [],
      durationMs: 0
    };

    try {
      // 1. Ensure Schedule is available
      const schedRes = await trainScheduleService.getSchedule(trainNo);
      if (schedRes.success) result.steps.timetable = true;

      // 2. Ensure Route Geometry is available
      const routeRes = await trainRouteService.getRouteGeometry(trainNo);
      if (routeRes.success) result.steps.route = true;

      // 3. Obtain Live Data or calculate Schedule-driven progression
      let normalized = liveData;
      if (!normalized && options.forcedProgress === undefined && !options.skipLiveApi) {
        try {
          const liveRes = await liveTrainService.fetchLiveTrain(trainNo);
          if (liveRes && liveRes.success && liveRes.data && liveRes.data.locationAvailable && liveRes.data.coordinates) {
            normalized = liveRes.data;
          }
        } catch (liveErr) {
          // Live API error
        }
      }

      // Schedule-based tracking fallback:
      // When live API is unavailable, rate-limited, or has no coordinates,
      // interpolate train along route geometry strictly from scheduled timetable.
      const schedData = schedRes?.data || (await trainScheduleService.getSchedule(trainNo))?.data;
      const scheduledState = await scheduleTrackingEngine.evaluateScheduledTrainState(
        schedData || trainNo,
        options.referenceTime || new Date()
      );

      const isLiveLocationMissing = !normalized || !normalized.coordinates || !normalized.locationAvailable;

      if (isLiveLocationMissing && scheduledState) {
        let coords = scheduledState.currentLocation.coordinates;
        let speedKmh = scheduledState.speed;
        let status = scheduledState.status;

        // Support forced progress for testing / simulation
        if (options.forcedProgress !== undefined) {
          const orientedTrack = getTrackGeometry(
            scheduledState.direction === DIRECTION.PATIALA_TO_DHABLAN ? 'PATIALA_TO_DHABLAN' : 'DHABLAN_TO_PATIALA'
          );
          coords = scheduleTrackingEngine.interpolateCoordinate(orientedTrack, options.forcedProgress);
          speedKmh = 50;
          status = options.forcedProgress < 1 ? 'IN_CORRIDOR' : 'COMPLETED';
        }

        normalized = {
          trainNumber: trainNo,
          trainName: scheduledState.trainName || (schedData && schedData.trainName) || `Train ${trainNo}`,
          coordinates: coords,
          latitude: coords[1],
          longitude: coords[0],
          locationAvailable: true,
          speedKmh,
          speed: speedKmh,
          delayMinutes: 0,
          currentStation: scheduledState.entryStation,
          nextStation: scheduledState.exitStation,
          status,
          dataSource: 'TIMETABLE',
          isScheduleDriven: true,
          scheduledProgress: scheduledState.progress,
          inCorridor: scheduledState.inCorridor,
          updatedAt: new Date()
        };
      }

      if (normalized) {
        result.steps.liveStatus = true;
        result.steps.normalization = true;
        result.liveData = normalized;
      }

      // 4. Update / verify Train document in MongoDB
      let trainDoc = await Train.findOne({ trainNumber: trainNo });
      const trainDirection = scheduledState?.direction || schedData?.corridorDirection || (trainDoc ? trainDoc.direction : 'UNKNOWN');

      if (!trainDoc && normalized) {
        trainDoc = await Train.create({
          trainNumber: trainNo,
          trainName: normalized.trainName || `Train ${trainNo}`,
          currentLocation: normalized.coordinates
            ? { type: 'Point', coordinates: normalized.coordinates }
            : { type: 'Point', coordinates: [76.398417, 30.339583] },
          speed: normalized.speedKmh || 0,
          delayMinutes: normalized.delayMinutes || 0,
          direction: trainDirection,
          status: normalized.status || 'SCHEDULED',
          inCorridor: Boolean(normalized.inCorridor),
          isApproaching: Boolean(normalized.isApproaching),
          scheduledProgress: normalized.scheduledProgress || 0,
          dataSource: normalized.dataSource || 'TIMETABLE',
          isMonitored: true,
          lastUpdatedAt: normalized.updatedAt || new Date()
        });
      } else if (trainDoc && normalized && normalized.coordinates) {
        trainDoc.currentLocation = { type: 'Point', coordinates: normalized.coordinates };
        trainDoc.speed = normalized.speedKmh !== undefined ? normalized.speedKmh : trainDoc.speed;
        trainDoc.delayMinutes = normalized.delayMinutes || 0;
        trainDoc.status = normalized.status || trainDoc.status;
        trainDoc.inCorridor = Boolean(normalized.inCorridor);
        trainDoc.isApproaching = Boolean(normalized.isApproaching);
        if (normalized.scheduledProgress !== undefined) {
          trainDoc.scheduledProgress = normalized.scheduledProgress;
        }
        if (trainDirection && trainDirection !== 'UNKNOWN') {
          trainDoc.direction = trainDirection;
        }
        trainDoc.dataSource = normalized.dataSource || trainDoc.dataSource;
        trainDoc.lastUpdatedAt = normalized.updatedAt || new Date();
        await trainDoc.save();
      }

      if (trainDoc) {
        result.steps.mongodb = true;
      }

      // 5. Load All 4 Monitored Phataks
      const phataks = await Phatak.find().sort({ number: 1 });
      if (phataks.length === 0) {
        console.warn('[Pipeline] No phataks found in database. Auto-seeding may be required.');
      }

      const thresholds = await this.getThresholds();

      // 6. Map Train to Phataks along Route Geometry
      if (trainDoc && trainDoc.currentLocation && trainDoc.currentLocation.coordinates) {
        const mappings = mapTrainToPhataks(trainDoc, phataks, thresholds.PHATAK_ROUTE_CORRIDOR_METERS || 100);
        result.mappings = mappings;
        result.steps.mapping = true;

        // Persist TrainPhatakMapping in MongoDB
        for (const m of mappings) {
          try {
            await TrainPhatakMapping.findOneAndUpdate(
              { trainNumber: trainNo, phatakNumber: m.phatakNumber },
              {
                trainNumber: trainNo,
                phatakNumber: m.phatakNumber,
                routePosition: m.phatakRoutePositionMeters,
                distanceFromRoute: m.distanceFromRouteMeters,
                sequence: m.sequence,
                direction: m.direction,
                confidence: m.confidence,
                isWithinCorridor: m.isWithinCorridor,
                calculatedAt: new Date()
              },
              { upsert: true, new: true }
            );
          } catch (mapErr) {
            console.warn(`[Pipeline] Error saving mapping for ${trainNo}-${m.phatakNumber}:`, mapErr.message);
          }
        }

        // Update Train document's upcoming phatak metrics
        const upcomingMappings = mappings.filter(m => m.distanceToPhatakMeters >= -100);
        if (upcomingMappings.length > 0) {
          const next = upcomingMappings[0];
          trainDoc.nextPhatakNumber = next.phatakNumber;
          trainDoc.distanceToNextPhatakMeters = Math.max(0, Math.round(next.distanceToPhatakMeters));
          const effectiveSpeed = trainDoc.speed > 0 ? trainDoc.speed : 50;
          const etaSec = next.distanceToPhatakMeters > 0 ? (next.distanceToPhatakMeters / (effectiveSpeed * 1000 / 3600)) : 0;
          trainDoc.etaToNextPhatakMinutes = Math.round((etaSec / 60) * 10) / 10;
          await trainDoc.save();
        } else {
          trainDoc.nextPhatakNumber = null;
          trainDoc.distanceToNextPhatakMeters = null;
          trainDoc.etaToNextPhatakMinutes = null;
          await trainDoc.save();
        }

        // 7. Calculate Predictions for Each Phatak
        const isTrainActive = Boolean(
          normalized.inCorridor ||
          normalized.status === 'IN_CORRIDOR' ||
          normalized.status === 'APPROACHING' ||
          options.forcedProgress !== undefined ||
          (normalized.speedKmh || 0) > 0
        );

        for (const m of mappings) {
          const isFarPast = m.distanceToPhatakMeters < -600;
          const shouldBeActive = !isFarPast && isTrainActive;

          if (!isFarPast && isTrainActive) {
            const rawPred = await fallbackPredictor.predictWithFallback(
              trainNo,
              m.phatakNumber,
              m.distanceToPhatakMeters,
              normalized,
              schedData || schedRes?.data || null
            );

            const smoothedEtaSec = predictionSmoother.smooth(
              trainNo,
              m.phatakNumber,
              rawPred.etaSeconds
            );

            const etaMinutes = Math.round((smoothedEtaSec / 60) * 10) / 10;
            const hasPassed = m.distanceToPhatakMeters < -100 || Boolean(m.hasPassed);

            const predDoc = await PhatakPrediction.findOneAndUpdate(
              { trainNumber: trainNo, phatakNumber: m.phatakNumber },
              {
                trainNumber: trainNo,
                phatakNumber: m.phatakNumber,
                distanceToPhatakMeters: m.distanceToPhatakMeters,
                distanceMeters: m.distanceToPhatakMeters,
                etaMinutes,
                hasPassed,
                predictedArrival: new Date(Date.now() + smoothedEtaSec * 1000),
                predictedClosure: rawPred.predictedClosure,
                predictedOpening: rawPred.predictedOpening,
                waitingTimeMinutes: rawPred.waitingTimeMinutes,
                confidence: rawPred.confidence,
                method: rawPred.method,
                dataSource: trainDoc.dataSource || normalized.dataSource || 'TIMETABLE',
                trainStatus: normalized.status || 'SCHEDULED',
                inCorridor: Boolean(normalized.inCorridor || options.forcedProgress !== undefined),
                speedKmh: normalized.speedKmh || normalized.speed || 0,
                isActive: true,
                calculatedAt: new Date()
              },
              { upsert: true, new: true }
            );

            result.predictions.push(predDoc);
          } else {
            await PhatakPrediction.updateMany(
              { trainNumber: trainNo, phatakNumber: m.phatakNumber },
              { isActive: false }
            );
          }
        }

        if (result.predictions.length > 0) {
          result.steps.prediction = true;
        }

        // 8. Update Gate State Machine for Each Phatak
        for (const phatak of phataks) {
          // Get all active predictions for this phatak
          const phatakPredictions = await PhatakPrediction.find({
            phatakNumber: phatak.number,
            isActive: true
          });

          // Evaluate state machine
          const transition = await gateStateMachine.processPhatakState(
            phatak,
            phatakPredictions,
            thresholds
          );

          if (transition.stateChanged) {
            result.gateTransitions.push(transition);

            // Handle Alert creation and notification
            const alertResult = await alertService.handleStatusChangeAlert({
              phatakNumber: phatak.number,
              previousStatus: transition.previousStatus,
              newStatus: transition.newStatus,
              trainNumber: transition.controllingTrainNumber
            });

            if (alertResult) {
              result.alerts.push(alertResult);
              socketManager.emitAlert(alertResult);
            }

            socketManager.emitGateStatusChange(transition);
          }

          // Broadcast latest phatak status with prediction joined
          const activePrediction = phatakPredictions.sort((a, b) => {
            return new Date(a.predictedArrival).getTime() - new Date(b.predictedArrival).getTime();
          })[0] || null;

          const updatedPhatak = await Phatak.findOne({ number: phatak.number });
          if (updatedPhatak) {
            socketManager.emitPhatakUpdate({
              ...updatedPhatak.toObject(),
              prediction: activePrediction
            });
          }
        }

        result.steps.gateStateMachine = true;

        // 9. Broadcast Train Update via Socket.IO
        if (trainDoc) {
          socketManager.emitTrainUpdate({
            ...trainDoc.toObject(),
            currentLocation: trainDoc.currentLocation,
            coordinates: trainDoc.currentLocation ? trainDoc.currentLocation.coordinates : null
          });
        }

        result.steps.socketBroadcast = true;
      }
    } catch (err) {
      console.error(`[PipelineOrchestrator] Error processing ${trainNo}:`, err.message);
      result.error = err.message;
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  /**
   * Evaluates gate state machine across all phataks based on currently active predictions.
   */
  async evaluateAllPhataks() {
    const phataks = await Phatak.find().sort({ number: 1 });
    const thresholds = await this.getThresholds();
    const transitions = [];

    for (const phatak of phataks) {
      const phatakPredictions = await PhatakPrediction.find({
        phatakNumber: phatak.number,
        isActive: true
      });

      const transition = await gateStateMachine.processPhatakState(
        phatak,
        phatakPredictions,
        thresholds
      );

      if (transition.stateChanged) {
        transitions.push(transition);
        const alertResult = await alertService.handleStatusChangeAlert({
          phatakNumber: phatak.number,
          previousStatus: transition.previousStatus,
          newStatus: transition.newStatus,
          trainNumber: transition.controllingTrainNumber
        });
        if (alertResult) {
          socketManager.emitAlert(alertResult);
        }
        socketManager.emitGateStatusChange(transition);
      }

      const activePrediction = phatakPredictions.sort((a, b) => {
        return new Date(a.predictedArrival).getTime() - new Date(b.predictedArrival).getTime();
      })[0] || null;

      const updatedPhatak = await Phatak.findOne({ number: phatak.number });
      if (updatedPhatak) {
        socketManager.emitPhatakUpdate({
          ...updatedPhatak.toObject(),
          prediction: activePrediction
        });
      }
    }
    return transitions;
  }
}

module.exports = new PipelineOrchestrator();
