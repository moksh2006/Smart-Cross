/**
 * Historical analytics. Every section declares what kind of data it is:
 *  - RECORDED:  derived from observed positions (live telemetry or simulation, see `mode`)
 *  - PREDICTED: software predictions (gate states, prediction samples)
 *  - ESTIMATED: values computed from models (e.g. closure duration)
 *  - API_LOG:   external API call log
 */
const {
  HistoricalTrainObservation, GateEvent, PredictionEvaluation, Prediction, AuditLog
} = require('../../models');
const { IST_OFFSET_MS } = require('../../utils/time');

const istHour = { $hour: { date: '$__date', timezone: 'Asia/Kolkata' } };
const withDate = (field) => [{ $addFields: { __date: `$${field}` } }];

async function summary({ days = 7, mode = 'LIVE' } = {}) {
  const since = new Date(Date.now() - days * 86400000);
  const m = { mode };

  const [frequencyByDay, frequencyByHour, speedByTrain, closureEstimates, closuresByHour,
    predictedClosedDurations, errorByHorizon, errorBySource, recentEvaluations, sourceDistribution,
    gateSourceDistribution, apiByDay, apiByStatus] = await Promise.all([
    HistoricalTrainObservation.aggregate([
      { $match: { ...m, observedArrival: { $gte: since } } },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$observedArrival', timezone: 'Asia/Kolkata' } }, train: '$trainNumber' } } },
      { $group: { _id: '$_id.day', trains: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    HistoricalTrainObservation.aggregate([
      { $match: { ...m, observedArrival: { $gte: since } } },
      ...withDate('observedArrival'),
      { $group: { _id: { hour: istHour, phatak: '$phatakNumber' }, passages: { $sum: 1 } } },
      { $sort: { '_id.hour': 1 } }
    ]),
    HistoricalTrainObservation.aggregate([
      { $match: { ...m, observedArrival: { $gte: since }, speedKmh: { $ne: null } } },
      { $group: { _id: '$trainNumber', avgSpeedKmh: { $avg: '$speedKmh' }, passages: { $sum: 1 }, avgDelayMinutes: { $avg: '$delayMinutes' } } },
      { $sort: { passages: -1 } },
      { $limit: 30 }
    ]),
    HistoricalTrainObservation.aggregate([
      { $match: { ...m, observedArrival: { $gte: since }, estimatedClosureSeconds: { $ne: null } } },
      { $group: { _id: '$phatakNumber', avgClosureSeconds: { $avg: '$estimatedClosureSeconds' }, samples: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    GateEvent.aggregate([
      { $match: { ...m, timestamp: { $gte: since }, newStatus: 'CLOSED' } },
      ...withDate('timestamp'),
      { $group: { _id: { hour: istHour, phatak: '$phatakNumber' }, closures: { $sum: 1 } } },
      { $sort: { '_id.hour': 1 } }
    ]),
    GateEvent.aggregate([
      { $match: { ...m, timestamp: { $gte: since }, previousStatus: 'CLOSED', previousStateDurationSeconds: { $ne: null, $gt: 0, $lt: 3600 } } },
      { $group: { _id: '$phatakNumber', avgClosedSeconds: { $avg: '$previousStateDurationSeconds' }, samples: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    PredictionEvaluation.aggregate([
      { $match: { ...m, evaluatedAt: { $gte: since } } },
      { $group: { _id: '$horizonMinutes', maeSeconds: { $avg: '$absoluteErrorSeconds' }, biasSeconds: { $avg: '$errorSeconds' }, samples: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]),
    PredictionEvaluation.aggregate([
      { $match: { ...m, evaluatedAt: { $gte: since } } },
      { $group: { _id: '$source', maeSeconds: { $avg: '$absoluteErrorSeconds' }, samples: { $sum: 1 } } },
      { $sort: { samples: -1 } }
    ]),
    PredictionEvaluation.find({ ...m, evaluatedAt: { $gte: since } }).sort({ evaluatedAt: -1 }).limit(50).lean(),
    Prediction.aggregate([
      { $match: { ...m, recordedAt: { $gte: since } } },
      { $group: { _id: '$source', samples: { $sum: 1 } } },
      { $sort: { samples: -1 } }
    ]),
    GateEvent.aggregate([
      { $match: { ...m, timestamp: { $gte: since }, source: { $ne: null } } },
      { $group: { _id: '$source', events: { $sum: 1 } } },
      { $sort: { events: -1 } }
    ]),
    AuditLog.aggregate([
      { $match: { category: 'EXTERNAL_API', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, calls: { $sum: 1 }, failures: { $sum: { $cond: ['$success', 0, 1] } } } },
      { $sort: { _id: 1 } }
    ]),
    AuditLog.aggregate([
      { $match: { category: 'EXTERNAL_API', createdAt: { $gte: since } } },
      { $group: { _id: { status: '$httpStatus', error: '$errorCode' }, calls: { $sum: 1 } } },
      { $sort: { calls: -1 } }
    ])
  ]);

  return {
    mode,
    days,
    since,
    generatedAt: new Date(),
    timezoneOffsetMinutes: IST_OFFSET_MS / 60000,
    trainFrequency: {
      dataKind: 'RECORDED',
      description: 'Distinct trains observed passing at least one crossing per day',
      byDay: frequencyByDay.map((r) => ({ day: r._id, trains: r.trains })),
      byHour: frequencyByHour.map((r) => ({ hour: r._id.hour, phatakNumber: r._id.phatak, passages: r.passages }))
    },
    averageSpeed: {
      dataKind: 'RECORDED',
      description: 'Average speed and delay at observed crossing passages',
      byTrain: speedByTrain.map((r) => ({
        trainNumber: r._id, avgSpeedKmh: Math.round(r.avgSpeedKmh), passages: r.passages,
        avgDelayMinutes: r.avgDelayMinutes === null ? null : Math.round(r.avgDelayMinutes * 10) / 10
      }))
    },
    waitingTime: {
      estimated: {
        dataKind: 'ESTIMATED',
        description: 'Estimated road closure duration per observed passage (model: threshold lead + train length + clearance)',
        byPhatak: closureEstimates.map((r) => ({ phatakNumber: r._id, avgSeconds: Math.round(r.avgClosureSeconds), samples: r.samples }))
      },
      predictedState: {
        dataKind: 'PREDICTED',
        description: 'Average time the predicted state stayed CLOSED',
        byPhatak: predictedClosedDurations.map((r) => ({ phatakNumber: r._id, avgSeconds: Math.round(r.avgClosedSeconds), samples: r.samples }))
      }
    },
    closurePatterns: {
      dataKind: 'PREDICTED',
      description: 'Predicted CLOSED transitions by hour of day (IST)',
      byHour: closuresByHour.map((r) => ({ hour: r._id.hour, phatakNumber: r._id.phatak, closures: r.closures }))
    },
    predictionAccuracy: {
      dataKind: 'RECORDED',
      description: 'Logged prediction vs observed passage (error = predicted − observed)',
      byHorizon: errorByHorizon.map((r) => ({ horizonMinutes: r._id, maeSeconds: Math.round(r.maeSeconds), biasSeconds: Math.round(r.biasSeconds), samples: r.samples })),
      bySource: errorBySource.map((r) => ({ source: r._id, maeSeconds: Math.round(r.maeSeconds), samples: r.samples })),
      recent: recentEvaluations.map((e) => ({
        trainNumber: e.trainNumber, phatakNumber: e.phatakNumber, horizonMinutes: e.horizonMinutes, source: e.source,
        predictedArrival: e.predictedArrival, observedArrival: e.observedArrival, errorSeconds: e.errorSeconds
      }))
    },
    sourceDistribution: {
      dataKind: 'PREDICTED',
      description: 'Prediction source used for logged predictions and for gate transitions',
      predictions: sourceDistribution.map((r) => ({ source: r._id, count: r.samples })),
      gateTransitions: gateSourceDistribution.map((r) => ({ source: r._id, count: r.events }))
    },
    apiUsage: {
      dataKind: 'API_LOG',
      description: 'RailRadar API calls (all modes)',
      byDay: apiByDay.map((r) => ({ day: r._id, calls: r.calls, failures: r.failures })),
      byStatus: apiByStatus.map((r) => ({ httpStatus: r._id.status, errorCode: r._id.error, calls: r.calls }))
    }
  };
}

module.exports = { summary };
