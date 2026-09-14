const express = require('express');
const router = express.Router();
const phatakController = require('../controllers/phatakController');

router.get('/nearby', phatakController.getNearbyPhataks);
router.get('/', phatakController.getAllPhataks);
router.get('/:id', phatakController.getPhatakById);

module.exports = router;
