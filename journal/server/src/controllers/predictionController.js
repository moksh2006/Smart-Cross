const PhatakPrediction = require('../models/PhatakPrediction');
const Phatak = require('../models/Phatak');
const Train = require('../models/Train');
const { mapTrainToPhataks } = require('../services/gis/mappingEngine');
const fallbackPredictor = require('../services/prediction/fallbackPredictor');
const predictionSmoother = require('../services/prediction/predictionSmoother');

exports.getActivePredictions = async (req, res, next) => {
  try {
    const predictions = await PhatakPrediction.find({ isActive: true }).sort({ phatakNumber: 1 });
    res.json({ success: true, count: predictions.length, data: predictions });
  } catch (err) {
    next(err);
  }
};

exports.recalculatePredictions = async (req, res, next) => {
  try {
    const phataks = await Phatak.find();
    const activeTrains = await Train.find({ isMonitored: true });

    const newPredictions = [];

    for (const train of activeTrains) {
      const mappings = mapTrainToPhataks(train, phataks);

      for (const mapping of mappings) {
        if (!mapping.hasPassed) {
          const rawPred = await fallbackPredictor.predictWithFallback(
            train.trainNumber,
            mapping.phatakNumber,
            mapping.distanceToPhatakMeters
          );

          // Apply prediction smoother
          const smoothedEtaSec = predictionSmoother.smooth(
            train.trainNumber,
            mapping.phatakNumber,
            rawPred.etaSeconds
          );

          const predDoc = await PhatakPrediction.findOneAndUpdate(
            { trainNumber: train.trainNumber, phatakNumber: mapping.phatakNumber },
            {
              trainNumber: train.trainNumber,
              phatakNumber: mapping.phatakNumber,
              distanceToPhatakMeters: mapping.distanceToPhatakMeters,
              etaMinutes: Math.round((smoothedEtaSec / 60) * 10) / 10,
              predictedArrival: new Date(Date.now() + smoothedEtaSec * 1000),
              predictedClosure: rawPred.predictedClosure,
              predictedOpening: rawPred.predictedOpening,
              waitingTimeMinutes: rawPred.waitingTimeMinutes,
              confidence: rawPred.confidence,
              method: rawPred.method,
              dataSource: train.dataSource || 'TIMETABLE',
              isActive: true,
              calculatedAt: new Date()
            },
            { upsert: true, new: true }
          );

          newPredictions.push(predDoc);
        }
      }
    }

    res.json({ success: true, count: newPredictions.length, data: newPredictions });
  } catch (err) {
    next(err);
  }
};
