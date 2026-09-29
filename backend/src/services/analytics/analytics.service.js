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
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT c.id, c.complaint_number, c.category, c.priority_level, c.status, c.latitude, c.longitude,
            d.name AS department_name, c.incident_id
     FROM complaints c
     LEFT JOIN departments d ON d.id = c.department_id
     ${where}`,
    params
  );
  return rows;
}

module.exports = {
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
