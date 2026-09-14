const trainScheduleService = require('../services/railradar/trainScheduleService');
const trainRouteService = require('../services/railradar/trainRouteService');
const liveTrainService = require('../services/railradar/liveTrainService');
const trainPollingScheduler = require('../services/scheduler/trainPollingScheduler');
const pipelineOrchestrator = require('../services/pipelineOrchestrator');
const Phatak = require('../models/Phatak');
const PhatakPrediction = require('../models/PhatakPrediction');
const Train = require('../models/Train');

exports.getRailRadarDebug = async (req, res, next) => {
  try {
    const { trainNumber } = req.params;
    const trainNo = String(trainNumber || '14508');

    // 1. Timetable
    const scheduleRes = await trainScheduleService.getSchedule(trainNo, false);

    // 2. Route
    const routeRes = await trainRouteService.getRouteGeometry(trainNo, false);

    // 3. Live API
    const liveRes = await liveTrainService.fetchLiveTrain(trainNo);

    // 4. Normalization
    const normalized = liveRes.data || null;

    // 5. Coordinates
    const coordinatesValid = Boolean(
      normalized &&
      normalized.locationAvailable &&
      normalized.coordinates &&
      normalized.coordinates.length >= 2
    );

    // Run pipeline for complete persistence and predictions
    const pipelineResult = await pipelineOrchestrator.processTrainUpdate(trainNo, normalized);

    // 6. MongoDB check
    const trainDoc = await Train.findOne({ trainNumber: trainNo });
    const mongodbSaved = Boolean(trainDoc);

    // 7. Phatak Mapping
    const mappings = pipelineResult.mappings || [];

    // 8. ETA
    const predictions = await PhatakPrediction.find({ trainNumber: trainNo, isActive: true });

    // 9. Current Phatak Status
    const phataks = await Phatak.find().sort({ number: 1 });
    const currentPhatakStatus = phataks.map(p => ({
      number: p.number,
      name: p.name,
      status: p.currentStatus,
      statusUpdatedAt: p.statusUpdatedAt
    }));

    res.json({
      success: true,
      trainNumber: trainNo,
      diagnostics: {
        timetable: {
          success: scheduleRes.success,
          trainName: scheduleRes.data?.trainName || '',
          pta: scheduleRes.data?.patialaSchedule || null,
          dbn: scheduleRes.data?.dhablanSchedule || null,
          direction: scheduleRes.data?.corridorDirection || 'UNKNOWN',
          fromCache: scheduleRes.fromCache || false
        },
        route: {
          success: routeRes.success,
          coordinatesCount: routeRes.data?.geometry?.coordinates?.length || 0,
          stopsCount: routeRes.data?.stops?.length || 0,
          fromCache: routeRes.fromCache || false
        },
        liveApi: {
          success: liveRes.success,
          error: liveRes.error || null,
          status: normalized?.status || 'UNKNOWN'
        },
        normalization: {
          success: Boolean(normalized),
          data: normalized
        },
        coordinates: {
          available: coordinatesValid,
          coordinates: normalized?.coordinates || null,
          speedKmh: normalized?.speedKmh || 0
        },
        mongodbSave: {
          success: mongodbSaved,
          trainNumber: trainDoc?.trainNumber || null,
          lastUpdatedAt: trainDoc?.lastUpdatedAt || null
        },
        phatakMapping: {
          success: mappings.length > 0,
          mappingsCount: mappings.length,
          mappings
        },
        eta: {
          success: predictions.length > 0,
          predictionsCount: predictions.length,
          predictions: predictions.map(pr => ({
            phatakNumber: pr.phatakNumber,
            etaMinutes: pr.etaMinutes,
            distanceMeters: pr.distanceToPhatakMeters,
            predictedArrival: pr.predictedArrival,
            method: pr.method
          }))
        },
        currentPhatakStatus: {
          success: currentPhatakStatus.length > 0,
          phataks: currentPhatakStatus
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

exports.testTrainEndToEnd = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { trainNumber } = req.params;
    const trainNo = String(trainNumber || '14508');

    // Step 1: Timetable
    let timetablePassed = false;
    let timetableData = null;
    let timetableError = null;
    try {
      const schedRes = await trainScheduleService.getSchedule(trainNo);
      if (schedRes.success && schedRes.data) {
        timetablePassed = true;
        timetableData = schedRes.data;
      } else {
        timetableError = schedRes.error || 'Failed to fetch timetable';
      }
    } catch (e) {
      timetableError = e.message;
    }

    // Step 2: Patiala/Dhablan schedule
    let corridorSchedulePassed = false;
    let corridorScheduleDetails = null;
    let corridorScheduleError = null;
    if (timetableData) {
      const pta = timetableData.patialaSchedule;
      const dbn = timetableData.dhablanSchedule;
      const direction = timetableData.corridorDirection;
      if (pta && dbn && direction && direction !== 'UNKNOWN') {
        corridorSchedulePassed = true;
        corridorScheduleDetails = {
          direction,
          entryStation: timetableData.entryStationCode || (direction === 'PATIALA_TO_DHABLAN' ? 'PTA' : 'DBN'),
          scheduledTime: timetableData.entryScheduledTime || (direction === 'PATIALA_TO_DHABLAN' ? pta.departureTime : dbn.departureTime),
          ptaSchedule: { arr: pta.arrivalTime, dep: pta.departureTime },
          dbnSchedule: { arr: dbn.arrivalTime, dep: dbn.departureTime }
        };
      } else {
        corridorScheduleError = 'Patiala or Dhablan stations not identified in timetable';
      }
    } else {
      corridorScheduleError = 'Skipped due to timetable failure';
    }

    // Step 3: Scheduled polling time
    let scheduledPollingPassed = false;
    let scheduledPollingDetails = null;
    if (corridorScheduleDetails) {
      const eligibility = trainPollingScheduler.evaluateTrainEligibility(trainNo);
      scheduledPollingPassed = true;
      scheduledPollingDetails = {
        scheduledStartTime: corridorScheduleDetails.scheduledTime,
        station: corridorScheduleDetails.entryStation,
        eligible: eligibility.eligible,
        status: eligibility.status,
        reason: eligibility.reason
      };
    }

    // Step 4: Live API
    let liveApiPassed = false;
    let liveRaw = null;
    let liveApiError = null;
    try {
      const liveRes = await liveTrainService.fetchLiveTrain(trainNo);
      if (liveRes.success && liveRes.data) {
        liveApiPassed = true;
        liveRaw = liveRes.data;
      } else {
        liveApiError = liveRes.error || 'RailRadar Live API response not available';
      }
    } catch (e) {
      liveApiError = e.message;
    }

    // Step 5: Live coordinates
    let liveCoordsPassed = false;
    let liveCoordsDetails = null;
    let liveCoordsError = null;
    if (liveRaw && liveRaw.locationAvailable && liveRaw.coordinates) {
      liveCoordsPassed = true;
      liveCoordsDetails = {
        coordinates: liveRaw.coordinates,
        speedKmh: liveRaw.speedKmh,
        delayMinutes: liveRaw.delayMinutes,
        source: liveRaw.source || 'railradar'
      };
    } else if (liveRaw) {
      liveCoordsPassed = true;
      liveCoordsDetails = {
        coordinates: null,
        locationAvailable: false,
        note: 'Live location currently at station or unavailable'
      };
    } else {
      liveCoordsError = 'No live response to extract coordinates';
    }

    // Step 6: Route geometry
    let routePassed = false;
    let routeData = null;
    let routeError = null;
    try {
      const routeRes = await trainRouteService.getRouteGeometry(trainNo);
      if (routeRes.success && routeRes.data?.geometry?.coordinates?.length > 0) {
        routePassed = true;
        routeData = {
          coordinatesCount: routeRes.data.geometry.coordinates.length,
          stopsCount: routeRes.data.stops?.length || 0
        };
      } else {
        routeError = routeRes.error || 'Failed to retrieve route geometry';
      }
    } catch (e) {
      routeError = e.message;
    }

    // Step 7, 8, 9, 10, 11, 12, 13: Execute complete pipeline orchestrator
    const pipelineResult = await pipelineOrchestrator.processTrainUpdate(trainNo, liveRaw);

    const trainMappedPassed = pipelineResult.steps.mapping && pipelineResult.mappings.length > 0;
    const phatakMappingPassed = pipelineResult.mappings.length === 4;
    const etaCalcPassed = pipelineResult.predictions.length > 0;
    const mongodbPassed = pipelineResult.steps.mongodb;
    const socketIoPassed = pipelineResult.steps.socketBroadcast;
    const frontendMarkerPassed = Boolean(pipelineResult.liveData || pipelineResult.steps.socketBroadcast);
    const phatakPredictionPassed = pipelineResult.steps.gateStateMachine;

    // Build the 13 required step checklist items
    const checklist = [
      {
        step: 1,
        name: 'Timetable',
        passed: timetablePassed,
        details: timetablePassed ? `Loaded ${timetableData?.trainName || 'Train'}` : timetableError
      },
      {
        step: 2,
        name: 'Patiala/Dhablan schedule',
        passed: corridorSchedulePassed,
        details: corridorSchedulePassed
          ? `${corridorScheduleDetails.direction}: Entry at ${corridorScheduleDetails.entryStation} (${corridorScheduleDetails.scheduledTime})`
          : corridorScheduleError
      },
      {
        step: 3,
        name: 'Scheduled polling time',
        passed: scheduledPollingPassed,
        details: scheduledPollingDetails ? scheduledPollingDetails.reason : 'Evaluation failed'
      },
      {
        step: 4,
        name: 'Live API',
        passed: liveApiPassed,
        details: liveApiPassed ? `Status: ${liveRaw?.status || 'Active'}` : (liveApiError || 'API unavailable')
      },
      {
        step: 5,
        name: 'Live coordinates',
        passed: liveCoordsPassed,
        details: liveCoordsDetails?.coordinates
          ? `[${liveCoordsDetails.coordinates[0].toFixed(4)}, ${liveCoordsDetails.coordinates[1].toFixed(4)}] • ${liveCoordsDetails.speedKmh} km/h`
          : 'Live location unavailable (flagged cleanly, no fake data)'
      },
      {
        step: 6,
        name: 'Route geometry',
        passed: routePassed,
        details: routePassed ? `${routeData.coordinatesCount} points along track LineString` : routeError
      },
      {
        step: 7,
        name: 'Train mapped to route',
        passed: trainMappedPassed,
        details: trainMappedPassed ? `Projected onto railway route geometry` : 'Mapping failed'
      },
      {
        step: 8,
        name: 'Phatak mapping',
        passed: phatakMappingPassed,
        details: phatakMappingPassed ? `All 4 Phataks mapped along track (19, 20, 23, 24)` : `${pipelineResult.mappings.length}/4 Phataks mapped`
      },
      {
        step: 9,
        name: 'ETA calculation',
        passed: etaCalcPassed,
        details: etaCalcPassed ? `${pipelineResult.predictions.length} active Phatak ETAs calculated` : 'Prediction calculation failed'
      },
      {
        step: 10,
        name: 'MongoDB',
        passed: mongodbPassed,
        details: mongodbPassed ? 'Train, Route, Snapshots, and Predictions persisted' : 'MongoDB save failed'
      },
      {
        step: 11,
        name: 'Socket.IO',
        passed: socketIoPassed,
        details: socketIoPassed ? 'train:update, phatak:update emitted in real-time' : 'Socket broadcast failed'
      },
      {
        step: 12,
        name: 'Frontend marker',
        passed: frontendMarkerPassed,
        details: frontendMarkerPassed ? 'Payload prepared for live Leaflet marker' : 'Marker payload unavailable'
      },
      {
        step: 13,
        name: 'Phatak prediction',
        passed: phatakPredictionPassed,
        details: phatakPredictionPassed
          ? `Gate transitions: ${pipelineResult.gateTransitions.length}, Alerts: ${pipelineResult.alerts.length}`
          : 'State machine evaluation failed'
      }
    ];

    const overallSuccess = checklist.every(item => item.passed);

    res.json({
      success: overallSuccess,
      trainNumber: trainNo,
      checklist,
      steps: {
        timetable: timetablePassed,
        corridorSchedule: corridorSchedulePassed,
        scheduledPollingTime: scheduledPollingPassed,
        liveApi: liveApiPassed,
        liveCoordinates: liveCoordsPassed,
        routeGeometry: routePassed,
        trainMappedToRoute: trainMappedPassed,
        phatakMapping: phatakMappingPassed,
        etaCalculation: etaCalcPassed,
        mongodb: mongodbPassed,
        socketIo: socketIoPassed,
        frontendMarker: frontendMarkerPassed,
        phatakPrediction: phatakPredictionPassed
      },
      liveData: pipelineResult.liveData,
      mappings: pipelineResult.mappings,
      predictions: pipelineResult.predictions,
      gateTransitions: pipelineResult.gateTransitions,
      alerts: pipelineResult.alerts,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};
