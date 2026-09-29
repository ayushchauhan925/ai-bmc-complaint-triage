const express = require('express');
const adminController = require('../controllers/admin.controller');
const dashboardController = require('../controllers/dashboard.controller');
const intelligenceController = require('../controllers/intelligence.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { assignSchema } = require('../validators/complaint.validator');
const { aiSearchSchema } = require('../validators/intelligence.validator');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authMiddleware, roleMiddleware(ROLES.ADMIN));

router.get('/complaints', adminController.listComplaints);
router.patch('/complaints/:id/assign', validateBody(assignSchema), adminController.assign);
router.get('/complaints/:id/recommend-officer', intelligenceController.recommendOfficer);
router.get('/statistics', adminController.statistics);
router.get('/map-data', adminController.mapData);
router.get('/analytics', dashboardController.fullAnalytics);
router.get('/departments', adminController.listDepartments);
router.get('/wards', adminController.listWards);
router.get('/officers', adminController.listOfficers);

// Civic Intelligence Center (Section 10)
router.get('/intelligence', intelligenceController.getIntelligence);
router.get('/hotspots', intelligenceController.getHotspots);

// AI admin natural-language search (Section 9)
router.post('/ai-search', validateBody(aiSearchSchema), intelligenceController.aiSearch);

// AI daily situation reports (Section 11)
router.post('/situation-report', intelligenceController.generateSituationReport);
router.get('/situation-reports', intelligenceController.listSituationReports);

// SLA escalation (Section 14)
router.post('/sla/check', intelligenceController.runSlaCheck);
router.get('/sla/escalations', intelligenceController.listSlaEscalations);

module.exports = router;
