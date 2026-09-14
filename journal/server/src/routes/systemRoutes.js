const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

router.get('/status', systemController.getSystemStatus);

module.exports = router;
