const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');

router.get('/railradar/:trainNumber', debugController.getRailRadarDebug);
router.post('/test-train/:trainNumber', debugController.testTrainEndToEnd);

module.exports = router;
