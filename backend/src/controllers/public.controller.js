const { pool } = require('../config/db');
const analyticsService = require('../services/analytics/analytics.service');
const asyncHandler = require('../utils/asyncHandler');

// Groups smaller than this are not published separately (small-cell suppression), to make
// re-identifying an individual from an aggregate implausible.
const MIN_GROUP_SIZE = 3;

// Section 20: public transparency dashboard data. No auth required, and deliberately
// excludes anything that could identify a citizen or expose a precise private address -
// only aggregate counts/rates. No coordinates, addresses, names or free text are returned.
const getPublicStatistics = asyncHandler(async (req, res) => {
  const [summary, resolution, duplicates, overTime] = await Promise.all([
    analyticsService.getSummaryStats(),
    analyticsService.getResolutionMetrics(),
    analyticsService.getDuplicateStats(),
    analyticsService.getComplaintsOverTime(30),
  ]);

  const [byCategoryRows] = await pool.query(
    `SELECT category, COUNT(*) AS count, SUM(status = 'RESOLVED') AS resolved
     FROM complaints GROUP BY category ORDER BY count DESC`
  );
  const [byStatusRows] = await pool.query('SELECT status, COUNT(*) AS count FROM complaints GROUP BY status');
  const [byDepartmentRows] = await pool.query(
    `SELECT d.name AS department, COUNT(c.id) AS total, SUM(c.status = 'RESOLVED') AS resolved,
            AVG(CASE WHEN c.status = 'RESOLVED' THEN TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at) END) AS avg_hours
     FROM complaints c JOIN departments d ON d.id = c.department_id
     GROUP BY d.name HAVING COUNT(c.id) >= ? ORDER BY total DESC`,
    [MIN_GROUP_SIZE]
  );
  const [[wow]] = await pool.query(
    `SELECT COALESCE(SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)), 0) AS this_week,
            COALESCE(SUM(created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)), 0) AS last_week
     FROM complaints WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)`
  );
  const [[incidents]] = await pool.query("SELECT COUNT(*) AS cnt FROM incidents WHERE status IN ('OPEN', 'IN_PROGRESS')");

  const total = Number(summary.total);
  const resolved = Number(summary.resolved);
  const thisWeek = Number(wow.this_week);
  const lastWeek = Number(wow.last_week);

  res.status(200).json({
    success: true,
    data: {
      generated_at: new Date().toISOString(),
      total_complaints: total,
      resolved,
      in_progress: Number(summary.in_progress),
      pending_or_active: Number(summary.pending_or_active),
      resolution_rate_pct: total > 0 ? Math.round((resolved / total) * 100) : null,
      active_incidents: Number(incidents.cnt),
      by_category: byCategoryRows
        .filter((c) => Number(c.count) >= MIN_GROUP_SIZE)
        .map((c) => ({ category: c.category, count: Number(c.count), resolved: Number(c.resolved || 0) })),
      by_status: byStatusRows.map((s) => ({ status: s.status, count: Number(s.count) })),
      by_department: byDepartmentRows.map((d) => ({
        department: d.department,
        total: Number(d.total),
        resolved: Number(d.resolved || 0),
        avg_resolution_hours: d.avg_hours === null ? null : Math.round(Number(d.avg_hours)),
      })),
      week_over_week: {
        this_week: thisWeek,
        last_week: lastWeek,
        change_pct: lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null,
      },
      complaints_over_time: overTime,
      avg_resolution_hours: resolution.avg_resolution_hours ? Math.round(Number(resolution.avg_resolution_hours)) : null,
      sla_compliance_pct:
        resolution.resolved_count > 0
          ? Math.round((Number(resolution.within_sla || 0) / resolution.resolved_count) * 100)
          : null,
      duplicate_rate_pct: duplicates.percentage,
      min_group_size: MIN_GROUP_SIZE,
      data_scope:
        'Aggregated counts only - no citizen names, contact details, or precise addresses are exposed. May include demo/seed data from this hackathon build, not verified official BMC statistics.',
    },
  });
});

module.exports = { getPublicStatistics };
