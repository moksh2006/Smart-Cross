const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');

router.post('/start', simulationController.startSimulation);
router.post('/stop', simulationController.stopSimulation);
router.post('/reset', simulationController.resetSimulation);
router.get('/status', simulationController.getSimulationStatus);

module.exports = router;
