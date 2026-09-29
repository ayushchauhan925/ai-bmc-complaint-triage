const analyticsService = require('../services/analytics/analytics.service');
const hotspotService = require('../services/complaint/hotspot.service');
const escalationService = require('../services/complaint/escalation.service');
const officerAssignmentService = require('../services/complaint/officerAssignment.service');
const adminSearchService = require('../services/admin/adminSearch.service');
const situationReportService = require('../services/admin/situationReport.service');
const incidentModel = require('../models/incident.model');
const situationReportModel = require('../models/situationReport.model');
const slaEscalationModel = require('../models/slaEscalation.model');
const adminQueryModel = require('../models/adminQuery.model');
const complaintModel = require('../models/complaint.model');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

// Section 10: Civic Intelligence Center. Combines verified deterministic aggregates (never
// fabricated) with hotspot clusters, recent incidents, and the most recent AI situation
// report if one exists and is recent - it does NOT auto-generate a new one on every load
// (that's an explicit admin action, to avoid unnecessary OpenAI calls - Section 27).
const getIntelligence = asyncHandler(async (req, res) => {
  const [summary, byDepartment, byWard, hotspots, recentIncidents, latestReport, slaCheck] = await Promise.all([
    analyticsService.getSummaryStats(),
    analyticsService.getByDepartment(),
    analyticsService.getByWard(),
    hotspotService.detectHotspots(),
    incidentModel.list({}, { page: 1, limit: 5 }),
    situationReportModel.findLatest(24),
    escalationService.runSlaEscalationCheck(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary,
      departmentWorkload: byDepartment,
      wardStatistics: byWard,
      hotspots,
      recentIncidents: recentIncidents.rows,
      latestSituationReport: latestReport
        ? { ...latestReport, summary: JSON.parse(latestReport.summary) }
        : null,
      slaCheck,
      dataScope: 'Live application data (includes any demo/seed data present) - not verified official BMC statistics.',
    },
  });
});

const getHotspots = asyncHandler(async (req, res) => {
  const hotspots = await hotspotService.detectHotspots();
  res.status(200).json({ success: true, data: { hotspots } });
});

// Section 9: AI admin natural-language search. Every query + the constrained filter object
// it produced is logged to ai_admin_queries for auditability (Section 28 observability).
const aiSearch = asyncHandler(async (req, res) => {
  const { query } = req.body;
  const result = await adminSearchService.runSearch(query);

  if (!result.success) {
    return res.status(200).json({ success: true, data: { available: false, reason: result.failureReason } });
  }

  await adminQueryModel.log({
    userId: req.user.id,
    queryText: query,
    filters: result.appliedFilters,
    resultCount: result.total,
  });

  res.status(200).json({
    success: true,
    data: {
      available: true,
      appliedFilters: result.appliedFilters,
      droppedFields: result.droppedFields,
      total: result.total,
      results: result.results,
    },
  });
});

const generateSituationReport = asyncHandler(async (req, res) => {
  const result = await situationReportService.generateSituationReport(req.user.id);
  if (!result.success) {
    return res.status(200).json({
      success: true,
      data: { available: false, reason: result.failureReason, statsSnapshot: result.statsSnapshot },
    });
  }
  res.status(201).json({
    success: true,
    data: { available: true, report: result.report, content: result.content, statsSnapshot: result.statsSnapshot },
  });
});

const listSituationReports = asyncHandler(async (req, res) => {
  const reports = await situationReportModel.list(20);
  res.status(200).json({
    success: true,
    data: { reports: reports.map((r) => ({ ...r, summary: JSON.parse(r.summary) })) },
  });
});

const runSlaCheck = asyncHandler(async (req, res) => {
  const result = await escalationService.runSlaEscalationCheck();
  res.status(200).json({ success: true, data: result });
});

const listSlaEscalations = asyncHandler(async (req, res) => {
  const escalations = await slaEscalationModel.recent(50);
  res.status(200).json({ success: true, data: { escalations } });
});

// Section 13: smart officer assignment recommendation for a given complaint.
const recommendOfficer = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.id);
  if (!complaint) {
    throw new AppError('Complaint not found.', 404);
  }
  if (!complaint.department_id) {
    return res.status(200).json({ success: true, data: { recommendations: [] } });
  }
  const recommendations = await officerAssignmentService.recommendOfficers({
    departmentId: complaint.department_id,
    latitude: Number(complaint.latitude),
    longitude: Number(complaint.longitude),
  });
  res.status(200).json({ success: true, data: { recommendations } });
});

module.exports = {
  getIntelligence,
  getHotspots,
  aiSearch,
  generateSituationReport,
  listSituationReports,
  runSlaCheck,
  listSlaEscalations,
  recommendOfficer,
};
