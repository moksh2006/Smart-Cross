const trainSimulationService = require('../services/simulation/trainSimulationService');
const socketManager = require('../services/websocket/socketManager');
const { DIRECTION } = require('../config/constants');

exports.startSimulation = async (req, res, next) => {
  try {
    const { direction, trainNumber, speedMultiplier } = req.body;

    trainSimulationService.startSimulation({
      direction: direction || DIRECTION.PATIALA_TO_DHABLAN,
      trainNumber: trainNumber || '14507',
      speedMultiplier: speedMultiplier || 2,
      onUpdateCallback: (payload) => {
        // Broadcast simulation telemetry via Socket.IO
        socketManager.emitTrainUpdate(payload.train);
        payload.phataks.forEach(p => socketManager.emitPhatakUpdate(p));
        payload.alerts.forEach(a => socketManager.emitAlert(a));
      }
    });

    res.json({
      success: true,
      message: 'Simulation started',
      status: trainSimulationService.getStatus()
    });
  } catch (err) {
    next(err);
  }
};

exports.stopSimulation = async (req, res, next) => {
  try {
    trainSimulationService.stopSimulation();
    res.json({ success: true, message: 'Simulation stopped', status: trainSimulationService.getStatus() });
  } catch (err) {
    next(err);
  }
};

exports.resetSimulation = async (req, res, next) => {
  try {
    trainSimulationService.resetSimulation();
    res.json({ success: true, message: 'Simulation reset', status: trainSimulationService.getStatus() });
  } catch (err) {
    next(err);
  }
};

exports.getSimulationStatus = (req, res) => {
  res.json({ success: true, data: trainSimulationService.getStatus() });
};
