const { pool } = require('../config/db');
const analyticsService = require('../services/analytics/analytics.service');
const anomalyService = require('../services/analytics/anomaly.service');
const forecastService = require('../services/analytics/forecast.service');
const workloadService = require('../services/analytics/departmentWorkload.service');
const hotspotService = require('../services/complaint/hotspot.service');
const escalationEventModel = require('../models/escalationEvent.model');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { CATEGORIES } = require('../utils/constants');

const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// Query-string -> validated geo filter. Unknown/invalid values are rejected, never passed on.
function parseGeoFilters(q) {
  const f = {};
  if (q.category) {
    if (!CATEGORIES.includes(q.category)) throw new AppError('Invalid category.', 400);
    f.category = q.category;
  }
  if (q.priority) {
    const list = String(q.priority).split(',').map((p) => p.trim().toUpperCase());
    if (list.some((p) => !PRIORITIES.includes(p))) throw new AppError('Invalid priority.', 400);
    f.priority = list;
  }
  if (q.department_id) f.departmentId = Number(q.department_id);
  if (q.status) f.status = String(q.status);
  if (q.days) f.days = Number(q.days);
  if (q.date_from) f.dateFrom = q.date_from;
  if (q.date_to) f.dateTo = q.date_to;
  if (q.radius) f.radiusMeters = Math.min(Math.max(Number(q.radius) || 350, 50), 2000);
  if (q.min_complaints) f.minComplaints = Math.min(Math.max(Number(q.min_complaints) || 3, 2), 50);
  if (q.mixed === 'true') f.mixedCategories = true;
  return f;
}

const overview = asyncHandler(async (req, res) => {
  const safe = async (fn, fallback) => {
    try { return await fn(); } catch (err) { return fallback; }
  };
  const [summary, trend, confidence, dup, sla, workload, hotspots, anomalies, escSummary, activeIncidents, reviewQueue, resolution] = await Promise.all([
    analyticsService.getSummaryStats(),
    analyticsService.getComplaintsOverTime(14),
    safe(() => analyticsService.getConfidenceDistribution(), null),
    analyticsService.getDuplicateStats(),
    analyticsService.getSlaSummary(),
    safe(() => workloadService.getWorkload(), []),
    safe(() => hotspotService.detectHotspotsAdvanced({ status: 'open', days: 14 }), { hotspots: [] }),
    safe(() => anomalyService.detectAnomalies(), { anomalies: [], sufficientData: false, notes: ['Anomaly detection unavailable.'] }),
    safe(() => escalationEventModel.summary(), []),
    pool.query("SELECT COUNT(*) AS cnt FROM incidents WHERE status IN ('OPEN', 'IN_PROGRESS')").then(([[r]]) => Number(r.cnt)),
    pool.query("SELECT COUNT(*) AS cnt FROM complaints WHERE review_required = TRUE AND status NOT IN ('RESOLVED', 'REJECTED')").then(([[r]]) => Number(r.cnt)),
    analyticsService.getResolutionMetrics(),
  ]);

  const openEscalations = escSummary.filter((e) => e.status === 'OPEN').reduce((s, e) => s + e.count, 0);
  res.status(200).json({
    success: true,
    data: {
      totals: {
        total: Number(summary.total),
        open: Number(summary.pending_or_active),
        resolved: Number(summary.resolved),
        highPriorityOpen: Number(summary.critical_count) + Number(summary.high_priority_count),
        slaBreaches: Number(summary.sla_breaches),
        activeIncidents,
        reviewQueue,
        openEscalations,
      },
      sla,
      trend,
      aiConfidence: confidence,
      duplicateRate: dup,
      resolution: {
        resolvedCount: Number(resolution.resolved_count),
        avgResolutionHours: resolution.avg_resolution_hours === null ? null : Number(Number(resolution.avg_resolution_hours).toFixed(1)),
      },
      hotspots: hotspots.hotspots.slice(0, 5),
      hotspotCount: hotspots.hotspots.length,
      anomalies: { sufficientData: anomalies.sufficientData, items: anomalies.anomalies.slice(0, 5), total: anomalies.anomalies.length, notes: anomalies.notes },
      departmentWorkload: workload,
      dataScope: 'Live application data (may include demo/seed complaints) - not official statistics.',
    },
  });
});

const trends = asyncHandler(async (req, res) => {
  const { days, category, department_id } = req.query;
  if (category && !CATEGORIES.includes(category)) throw new AppError('Invalid category.', 400);
  const data = await analyticsService.getTrends({ days, category, departmentId: department_id });
  res.status(200).json({ success: true, data });
});

const heatmap = asyncHandler(async (req, res) => {
  const data = await hotspotService.getHeatmapPoints(parseGeoFilters(req.query));
  res.status(200).json({ success: true, data });
});

const hotspots = asyncHandler(async (req, res) => {
  const data = await hotspotService.detectHotspotsAdvanced(parseGeoFilters(req.query));
  res.status(200).json({ success: true, data });
});

const anomalies = asyncHandler(async (req, res) => {
  const data = await anomalyService.detectAnomalies({ force: req.query.refresh === 'true' });
  res.status(200).json({ success: true, data });
});

const forecast = asyncHandler(async (req, res) => {
  const horizon = Math.min(Math.max(Number(req.query.horizon) || 7, 1), 14);
  const data = await forecastService.getForecasts({ horizon });
  res.status(200).json({ success: true, data });
});

const departmentWorkload = asyncHandler(async (req, res) => {
  const workload = await workloadService.getWorkload();
  const detail = req.query.department_id
    ? await workloadService.getDepartmentTrend(Number(req.query.department_id), req.query.days)
    : null;
  res.status(200).json({ success: true, data: { departments: workload, trend: detail } });
});

module.exports = { overview, trends, heatmap, hotspots, anomalies, forecast, departmentWorkload };
