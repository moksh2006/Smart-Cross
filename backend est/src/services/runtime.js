/**
 * Application runtime: constructs and wires the long-lived services once.
 */
const { CorridorEngine } = require('./engine/corridorEngine');
const { AlertService } = require('./alert/alertService');
const { TrainPollingScheduler } = require('./scheduler/trainPollingScheduler');
const { SimulationEngine } = require('./simulation/simulationEngine');
const socketManager = require('./websocket/socketManager');
const { client } = require('./railradar/railRadarClient');
const { SOCKET_EVENTS } = require('../config/constants');

const alertService = new AlertService({ emit: (alert) => socketManager.emit(SOCKET_EVENTS.ALERT_NEW, alert) });
const engine = new CorridorEngine({ alertService });
engine.setEmitter(socketManager);
const scheduler = new TrainPollingScheduler({ engine, alertService });
const simulation = new SimulationEngine({ engine });
engine.setFeedStatusProvider(() => {
  const api = client.status();
  return {
    railRadar: {
      configured: api.configured,
      remainingQuota: api.remainingQuota,
      monthlyQuota: api.monthlyQuota,
      callsToday: api.callsToday,
      dailyBudget: api.dailyBudget,
      lastSuccessAt: api.lastSuccessAt,
      lastError: api.lastError,
      authFailed: api.authFailed,
      cooldownUntil: api.cooldownUntil
    },
    schedulerRunning: scheduler.status().running,
    simulationRunning: simulation.running,
    simulatedTrains: simulation.trains.size
  };
});

module.exports = { engine, alertService, scheduler, simulation, socketManager, apiClient: client };
