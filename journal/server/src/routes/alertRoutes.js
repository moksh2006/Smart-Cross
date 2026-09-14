const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

router.get('/', alertController.getRecentAlerts);
router.post('/subscribe', alertController.subscribePush);

module.exports = router;
