const express = require('express');
const adminController = require('../controllers/admin.controller');
const dashboardController = require('../controllers/dashboard.controller');
const intelligenceController = require('../controllers/intelligence.controller');
const opsController = require('../controllers/ops.controller');
const orgController = require('../controllers/orgAdmin.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { assignSchema } = require('../validators/complaint.validator');
const { aiSearchSchema } = require('../validators/intelligence.validator');
const { evaluationSchema } = require('../validators/ops.validator');
const { officerCreateSchema, officerUpdateSchema, departmentUpdateSchema } = require('../validators/org.validator');
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

// Department catalog + officer management
router.get('/departments/overview', orgController.listDepartmentOverview);
router.patch('/departments/:id', validateBody(departmentUpdateSchema), orgController.updateDepartment);
router.get('/officers/overview', orgController.officerOverview);
router.post('/officers', validateBody(officerCreateSchema), orgController.createOfficer);
router.patch('/officers/:id', validateBody(officerUpdateSchema), orgController.updateOfficer);

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

// Auditability, AI quality/cost and system health (Section 22, 27-29).
router.get('/audit-logs', opsController.auditLogs);
router.get('/ai-usage', opsController.aiUsageSummary);
router.get('/ai-performance', opsController.aiPerformance);
router.post('/evaluations/run', validateBody(evaluationSchema), opsController.runEvaluation);
router.get('/evaluations/:runId', opsController.evaluationRun);
router.get('/observability', opsController.observability);
router.post('/jobs/:name/run', opsController.runJob);
router.get('/search/semantic', opsController.semantic);

module.exports = router;
