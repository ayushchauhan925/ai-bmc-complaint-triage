const { pool } = require('../../config/db');

const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const ratio = (a, b) => (b > 0 ? Number((a / b).toFixed(3)) : null);

/**
 * Department-level operational analytics, all straight SQL over stored data.
 *
 *   slaCompliance = resolvedWithinSla / (resolvedWithinSla + resolvedAfterSla + openBreached)
 *
 * i.e. every complaint that has *already* met or missed its SLA is counted; complaints still
 * inside their window are not (they have not been judged yet). Null means "no judged
 * complaints yet" rather than 100%.
 */
async function getWorkload() {
  const [rows] = await pool.query(`
    SELECT d.id, d.code, d.name,
      COUNT(c.id) AS assigned,
      COALESCE(SUM(c.status NOT IN ('RESOLVED', 'REJECTED')), 0) AS pending,
      COALESCE(SUM(c.status = 'IN_PROGRESS'), 0) AS in_progress,
      COALESCE(SUM(c.status = 'RESOLVED'), 0) AS resolved,
      COALESCE(SUM(c.status NOT IN ('RESOLVED', 'REJECTED') AND c.sla_deadline IS NOT NULL AND c.sla_deadline < NOW()), 0) AS overdue,
      COALESCE(SUM(c.sla_status = 'COMPLETED_WITHIN_SLA'), 0) AS within_sla,
      COALESCE(SUM(c.sla_status = 'COMPLETED_AFTER_SLA'), 0) AS after_sla,
      AVG(CASE WHEN c.status = 'RESOLVED' THEN TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at) END) AS avg_resolution_hours,
      COALESCE(SUM(c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)), 0) AS incoming_7d,
      COALESCE(SUM(c.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND c.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)), 0) AS incoming_prev_7d,
      COALESCE(SUM(c.status NOT IN ('RESOLVED', 'REJECTED') AND c.priority_level IN ('CRITICAL', 'HIGH')), 0) AS pending_high_priority
    FROM departments d LEFT JOIN complaints c ON c.department_id = d.id
    GROUP BY d.id, d.code, d.name ORDER BY pending DESC, d.name`);

  const [cats] = await pool.query(
    `SELECT department_id, category, COUNT(*) AS cnt FROM complaints
     WHERE department_id IS NOT NULL GROUP BY department_id, category ORDER BY cnt DESC`
  );
  const catsByDept = new Map();
  for (const c of cats) {
    if (!catsByDept.has(c.department_id)) catsByDept.set(c.department_id, []);
    catsByDept.get(c.department_id).push({ category: c.category, count: num(c.cnt) });
  }

  return rows.map((r) => {
    const withinSla = num(r.within_sla);
    const afterSla = num(r.after_sla);
    const openBreached = num(r.overdue);
    const incoming = num(r.incoming_7d);
    const prev = num(r.incoming_prev_7d);
    return {
      departmentId: r.id,
      code: r.code,
      department: r.name,
      assigned: num(r.assigned),
      pending: num(r.pending),
      inProgress: num(r.in_progress),
      resolved: num(r.resolved),
      overdue: openBreached,
      pendingHighPriority: num(r.pending_high_priority),
      avgResolutionHours: r.avg_resolution_hours === null ? null : Number(Number(r.avg_resolution_hours).toFixed(1)),
      slaCompliance: ratio(withinSla, withinSla + afterSla + openBreached),
      backlog: num(r.pending),
      incoming7d: incoming,
      incomingPrev7d: prev,
      incomingTrend: prev === 0 ? (incoming > 0 ? 'NEW' : 'FLAT') : incoming > prev * 1.2 ? 'UP' : incoming < prev * 0.8 ? 'DOWN' : 'FLAT',
      categoryDistribution: catsByDept.get(r.id) || [],
    };
  });
}

/** Daily incoming vs resolved for one department (workload trend). */
async function getDepartmentTrend(departmentId, days = 30) {
  const safeDays = Math.min(Math.max(Number(days) || 30, 7), 180);
  const [incoming] = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count FROM complaints
     WHERE department_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY DATE(created_at) ORDER BY date`,
    [departmentId, safeDays]
  );
  const [resolved] = await pool.query(
    `SELECT DATE(resolved_at) AS date, COUNT(*) AS count FROM complaints
     WHERE department_id = ? AND status = 'RESOLVED' AND resolved_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(resolved_at) ORDER BY date`,
    [departmentId, safeDays]
  );
  return { incoming, resolved };
}

module.exports = { getWorkload, getDepartmentTrend };
