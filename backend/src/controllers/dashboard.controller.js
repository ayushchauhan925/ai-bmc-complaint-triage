const analyticsService = require('../services/analytics/analytics.service');
const asyncHandler = require('../utils/asyncHandler');

const fullAnalytics = asyncHandler(async (req, res) => {
  const [
    summary,
    overTime,
    byCategory,
    byDepartment,
    byPriority,
    byWard,
    byStatus,
    resolution,
    duplicates,
    reopened,
    satisfaction,
  ] = await Promise.all([
    analyticsService.getSummaryStats(),
    analyticsService.getComplaintsOverTime(30),
    analyticsService.getByCategory(),
    analyticsService.getByDepartment(),
    analyticsService.getByPriority(),
    analyticsService.getByWard(),
    analyticsService.getByStatus(),
    analyticsService.getResolutionMetrics(),
    analyticsService.getDuplicateStats(),
    analyticsService.getReopenedCount(),
    analyticsService.getCitizenSatisfaction(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary,
      overTime,
      byCategory,
      byDepartment,
      byPriority,
      byWard,
      byStatus,
      resolution,
      duplicates,
      reopened,
      satisfaction,
    },
  });
});

module.exports = { fullAnalytics };
