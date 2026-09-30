const { pool } = require('../../config/db');

async function getSummaryStats() {
  const [[totals]] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      SUM(status NOT IN ('RESOLVED', 'REJECTED')) AS pending_or_active,
      SUM(status = 'IN_PROGRESS') AS in_progress,
      SUM(status = 'RESOLVED') AS resolved,
      SUM(priority_level = 'CRITICAL') AS critical_count,
      SUM(priority_level = 'HIGH') AS high_priority_count,
      SUM(sla_status = 'BREACHED') AS sla_breaches,
      SUM(review_required = TRUE) AS needs_review
    FROM complaints
  `);
  return totals;
}

async function getComplaintsOverTime(days = 30) {
  const [rows] = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM complaints
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [days]
  );
  return rows;
}

async function getByCategory() {
  const [rows] = await pool.query(
    `SELECT category, COUNT(*) AS count FROM complaints GROUP BY category ORDER BY count DESC`
  );
  return rows;
}

async function getByDepartment() {
  const [rows] = await pool.query(
    `SELECT d.name AS department, COUNT(c.id) AS count
     FROM complaints c LEFT JOIN departments d ON d.id = c.department_id
     GROUP BY d.name ORDER BY count DESC`
  );
  return rows;
}

async function getByPriority() {
  const [rows] = await pool.query(
    `SELECT priority_level, COUNT(*) AS count FROM complaints GROUP BY priority_level`
  );
  return rows;
}

async function getByWard() {
  const [rows] = await pool.query(
    `SELECT w.ward_name AS ward, COUNT(c.id) AS count
     FROM complaints c LEFT JOIN wards w ON w.id = c.ward_id
     GROUP BY w.ward_name ORDER BY count DESC`
  );
  return rows;
}

async function getByStatus() {
  const [rows] = await pool.query(`SELECT status, COUNT(*) AS count FROM complaints GROUP BY status`);
  return rows;
}

async function getResolutionMetrics() {
  const [[row]] = await pool.query(`
    SELECT
      COUNT(*) AS resolved_count,
      AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) AS avg_resolution_hours,
      SUM(sla_status = 'COMPLETED_WITHIN_SLA') AS within_sla,
      SUM(sla_status = 'COMPLETED_AFTER_SLA') AS after_sla
    FROM complaints WHERE status = 'RESOLVED'
  `);
  return row;
}

async function getDuplicateStats() {
  const [[row]] = await pool.query(`
    SELECT COUNT(*) AS total, SUM(incident_id IS NOT NULL) AS grouped
    FROM complaints
  `);
  const percentage = row.total > 0 ? (row.grouped / row.total) * 100 : 0;
  return { total: row.total, grouped: row.grouped || 0, percentage: Number(percentage.toFixed(1)) };
}

async function getReopenedCount() {
  const [[row]] = await pool.query(
    `SELECT COUNT(DISTINCT complaint_id) AS count FROM complaint_status_history WHERE new_status = 'REOPENED'`
  );
  return row.count;
}

async function getCitizenSatisfaction() {
  const [[row]] = await pool.query(`
    SELECT AVG(rating) AS avg_rating, COUNT(*) AS total_feedback,
      SUM(resolved = TRUE) AS confirmed_resolved, SUM(resolved = FALSE) AS disputed
    FROM feedback
  `);
  return row;
}

async function getRecentCritical(limit = 10) {
  const [rows] = await pool.query(
    `SELECT c.*, d.name AS department_name FROM complaints c
     LEFT JOIN departments d ON d.id = c.department_id
     WHERE c.priority_level = 'CRITICAL' AND c.status NOT IN ('RESOLVED', 'REJECTED')
     ORDER BY c.created_at DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

async function getSlaBreaches(limit = 20) {
  const [rows] = await pool.query(
    `SELECT c.*, d.name AS department_name FROM complaints c
     LEFT JOIN departments d ON d.id = c.department_id
     WHERE c.sla_status = 'BREACHED'
     ORDER BY c.sla_deadline ASC LIMIT ?`,
    [limit]
  );
  return rows;
}

async function getMapData(filters = {}) {
  const clauses = [];
  const params = [];
  if (filters.category) {
    clauses.push('c.category = ?');
    params.push(filters.category);
  }
  if (filters.priority_level) {
    clauses.push('c.priority_level = ?');
    params.push(filters.priority_level);
  }
  if (filters.status) {
    clauses.push('c.status = ?');
    params.push(filters.status);
  }
  if (filters.department_id) {
    clauses.push('c.department_id = ?');
    params.push(filters.department_id);
  }
  if (filters.ward_id) {
    clauses.push('c.ward_id = ?');
    params.push(filters.ward_id);
  }
  if (filters.days) {
    clauses.push('c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)');
    params.push(Math.min(Math.max(Number(filters.days) || 30, 1), 365));
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT c.id, c.complaint_number, c.category, c.priority_level, c.status, c.latitude, c.longitude,
            d.name AS department_name, c.incident_id, c.sla_status, c.created_at
     FROM complaints c
     LEFT JOIN departments d ON d.id = c.department_id
     ${where}`,
    params
  );
  return rows;
}

/** Daily created/resolved counts plus top-category series, with an honest week-over-week change. */
async function getTrends({ days = 30, category, departmentId } = {}) {
  const safeDays = Math.min(Math.max(Number(days) || 30, 7), 180);
  const clauses = [];
  const params = [];
  if (category) { clauses.push('category = ?'); params.push(category); }
  if (departmentId) { clauses.push('department_id = ?'); params.push(Number(departmentId)); }
  const extra = clauses.length ? `AND ${clauses.join(' AND ')}` : '';

  const [created] = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count FROM complaints
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ${extra} GROUP BY DATE(created_at) ORDER BY date`,
    [safeDays, ...params]
  );
  const [resolved] = await pool.query(
    `SELECT DATE(resolved_at) AS date, COUNT(*) AS count FROM complaints
     WHERE status = 'RESOLVED' AND resolved_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ${extra} GROUP BY DATE(resolved_at) ORDER BY date`,
    [safeDays, ...params]
  );
  const [byCategoryDaily] = await pool.query(
    `SELECT DATE(created_at) AS date, category, COUNT(*) AS count FROM complaints
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ${extra}
       AND category IN (SELECT category FROM (SELECT category FROM complaints
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY category ORDER BY COUNT(*) DESC LIMIT 5) t)
     GROUP BY DATE(created_at), category ORDER BY date`,
    [safeDays, ...params, safeDays]
  );
  const [[wow]] = await pool.query(
    `SELECT COALESCE(SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)), 0) AS this_week,
            COALESCE(SUM(created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)), 0) AS last_week
     FROM complaints WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) ${extra}`,
    params
  );
  const thisWeek = Number(wow.this_week);
  const lastWeek = Number(wow.last_week);
  return {
    windowDays: safeDays,
    created,
    resolved,
    byCategoryDaily,
    weekOverWeek: { thisWeek, lastWeek, changePct: lastWeek > 0 ? Number((((thisWeek - lastWeek) / lastWeek) * 100).toFixed(1)) : null },
  };
}

async function getConfidenceDistribution() {
  const [rows] = await pool.query(
    `SELECT FLOOR(LEAST(ai_confidence, 0.999) * 10) AS bucket, COUNT(*) AS count
     FROM complaints WHERE ai_confidence IS NOT NULL GROUP BY bucket ORDER BY bucket`
  );
  const buckets = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${i * 10 + 10}%`, count: 0 }));
  for (const r of rows) buckets[Number(r.bucket)].count = Number(r.count);
  const [[meta]] = await pool.query(
    'SELECT COUNT(*) AS analysed, AVG(ai_confidence) AS avg_conf, SUM(ai_analysis_failed = TRUE) AS failed FROM complaints'
  );
  return {
    buckets,
    analysed: Number(meta.analysed) - Number(meta.failed || 0),
    avgConfidence: meta.avg_conf === null ? null : Number(Number(meta.avg_conf).toFixed(3)),
    aiFailures: Number(meta.failed || 0),
  };
}

async function getSlaSummary() {
  const [rows] = await pool.query(
    `SELECT sla_status, COUNT(*) AS count FROM complaints WHERE status NOT IN ('RESOLVED', 'REJECTED') GROUP BY sla_status`
  );
  const out = { ON_TRACK: 0, APPROACHING: 0, BREACHED: 0 };
  for (const r of rows) out[r.sla_status] = Number(r.count);
  return out;
}

module.exports = {
  getTrends,
  getConfidenceDistribution,
  getSlaSummary,
  getSummaryStats,
  getComplaintsOverTime,
  getByCategory,
  getByDepartment,
  getByPriority,
  getByWard,
  getByStatus,
  getResolutionMetrics,
  getDuplicateStats,
  getReopenedCount,
  getCitizenSatisfaction,
  getRecentCritical,
  getSlaBreaches,
  getMapData,
};
