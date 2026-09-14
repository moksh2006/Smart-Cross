const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/metrics', adminController.getAdminMetrics);
router.get('/api-logs', adminController.getApiLogs);

module.exports = router;
