const analyticsService = require('../services/analytics/analytics.service');
const asyncHandler = require('../utils/asyncHandler');

// Section 20: public transparency dashboard data. No auth required, and deliberately
// excludes anything that could identify a citizen or expose a precise private address -
// only aggregate counts/rates.
const getPublicStatistics = asyncHandler(async (req, res) => {
  const [summary, byCategory, resolution, duplicates, overTime] = await Promise.all([
    analyticsService.getSummaryStats(),
    analyticsService.getByCategory(),
    analyticsService.getResolutionMetrics(),
    analyticsService.getDuplicateStats(),
    analyticsService.getComplaintsOverTime(30),
  ]);

  res.status(200).json({
    success: true,
    data: {
      total_complaints: Number(summary.total),
      resolved: Number(summary.resolved),
      in_progress: Number(summary.in_progress),
      pending_or_active: Number(summary.pending_or_active),
      by_category: byCategory.map((c) => ({ category: c.category, count: Number(c.count) })),
      complaints_over_time: overTime,
      avg_resolution_hours: resolution.avg_resolution_hours ? Math.round(Number(resolution.avg_resolution_hours)) : null,
      sla_compliance_pct:
        resolution.resolved_count > 0
          ? Math.round((Number(resolution.within_sla || 0) / resolution.resolved_count) * 100)
          : null,
      duplicate_rate_pct: duplicates.percentage,
      data_scope:
        'Aggregated counts only - no citizen names, contact details, or precise addresses are exposed. May include demo/seed data from this hackathon build, not verified official BMC statistics.',
    },
  });
});

module.exports = { getPublicStatistics };
