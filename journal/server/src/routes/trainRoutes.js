const express = require('express');
const router = express.Router();
const trainController = require('../controllers/trainController');

router.get('/', trainController.getAllTrains);
router.get('/:number', trainController.getTrainByNumber);
router.post('/:number/refresh', trainController.refreshTrainLive);
router.post('/:number/simulate-schedule', trainController.simulateTrainSchedule);

module.exports = router;
