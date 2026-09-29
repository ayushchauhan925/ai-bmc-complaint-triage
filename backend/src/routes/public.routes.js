const express = require('express');
const publicController = require('../controllers/public.controller');

const router = express.Router();

// Deliberately no authMiddleware - this is the public transparency dashboard (Section 20).
router.get('/statistics', publicController.getPublicStatistics);

module.exports = router;
