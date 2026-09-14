const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predictionController');

router.get('/', predictionController.getActivePredictions);
router.post('/recalculate', predictionController.recalculatePredictions);

module.exports = router;
