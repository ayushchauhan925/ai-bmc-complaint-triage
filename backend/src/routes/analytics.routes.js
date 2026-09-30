const express = require('express');
const analyticsController = require('../controllers/analytics.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// Operational intelligence is staff-facing; all analytics are admin-only.
router.use(authMiddleware, roleMiddleware(ROLES.ADMIN));

router.get('/overview', analyticsController.overview);
router.get('/trends', analyticsController.trends);
router.get('/heatmap', analyticsController.heatmap);
router.get('/hotspots', analyticsController.hotspots);
router.get('/clusters', analyticsController.hotspots); // alias: density clusters == hotspots
router.get('/anomalies', analyticsController.anomalies);
router.get('/forecast', analyticsController.forecast);
router.get('/department-workload', analyticsController.departmentWorkload);

module.exports = router;
