const { pool } = require('../../config/db');
const { haversineDistanceMeters } = require('../../utils/vectorMath');

/**
 * Smart officer recommendation. Fully deterministic - the LLM never assigns anyone, and the
 * result is only a *ranked suggestion*: an authorised admin makes the final assignment.
 *
 * Candidates: ACTIVE officers of the complaint's department only (inactive officers are never
 * suggested). Ranking, in order:
 *   1. ward match      - officers assigned to the complaint's ward come first (when it has one)
 *   2. workload        - fewer open assignments first
 *   3. critical load   - fewer open CRITICAL assignments first
 *   4. SLA breaches    - fewer currently-breached assignments first
 *   5. proximity       - closer average distance to the complaint, from their current open work
 *                        (there is no stored officer location, so this is an approximation)
 * Each recommendation carries human-readable `reasons` so the admin can see why.
 */
async function recommendOfficers({ departmentId, latitude, longitude, wardId = null }) {
  const [officers] = await pool.query(
    `SELECT u.id, u.name, u.email, u.ward_id, w.ward_name
     FROM users u LEFT JOIN wards w ON w.id = u.ward_id
     WHERE u.role = 'OFFICER' AND u.is_active = TRUE AND u.department_id = ?`,
    [departmentId]
  );
  if (officers.length === 0) return [];

  const [open] = await pool.query(
    `SELECT officer_id, latitude, longitude, priority_level, sla_status FROM complaints
     WHERE officer_id IN (${officers.map(() => '?').join(',')}) AND status NOT IN ('RESOLVED', 'REJECTED')`,
    officers.map((o) => o.id)
  );
  const byOfficer = new Map();
  for (const row of open) {
    if (!byOfficer.has(row.officer_id)) byOfficer.set(row.officer_id, []);
    byOfficer.get(row.officer_id).push(row);
  }

  const results = officers.map((officer) => {
    const rows = byOfficer.get(officer.id) || [];
    const workload = rows.length;
    const criticalCount = rows.filter((r) => r.priority_level === 'CRITICAL').length;
    const slaBreaches = rows.filter((r) => r.sla_status === 'BREACHED').length;

    let nearbyAssignments = 0;
    let avgDistanceMeters = null;
    if (rows.length > 0 && latitude != null && longitude != null) {
      const distances = rows.map((r) => haversineDistanceMeters(latitude, longitude, Number(r.latitude), Number(r.longitude)));
      nearbyAssignments = distances.filter((d) => d <= 1000).length;
      avgDistanceMeters = Math.round(distances.reduce((a, b) => a + b, 0) / distances.length);
    }

    const wardMatch = wardId != null && officer.ward_id === wardId;
    const reasons = [];
    if (wardMatch) reasons.push('Assigned to this complaint\'s ward');
    reasons.push(workload === 0 ? 'No open assignments' : `${workload} open assignment${workload === 1 ? '' : 's'}`);
    if (criticalCount > 0) reasons.push(`${criticalCount} critical`);
    if (slaBreaches > 0) reasons.push(`${slaBreaches} SLA breach${slaBreaches === 1 ? '' : 'es'}`);
    if (nearbyAssignments > 0) reasons.push(`${nearbyAssignments} open job${nearbyAssignments === 1 ? '' : 's'} within 1 km`);

    return {
      officerId: officer.id,
      name: officer.name,
      email: officer.email,
      wardId: officer.ward_id,
      wardName: officer.ward_name || null,
      wardMatch,
      workload,
      criticalCount,
      slaBreaches,
      nearbyAssignments,
      avgDistanceMeters,
      reasons,
    };
  });

  results.sort((a, b) => {
    if (a.wardMatch !== b.wardMatch) return a.wardMatch ? -1 : 1;
    if (a.workload !== b.workload) return a.workload - b.workload;
    if (a.criticalCount !== b.criticalCount) return a.criticalCount - b.criticalCount;
    if (a.slaBreaches !== b.slaBreaches) return a.slaBreaches - b.slaBreaches;
    if (a.avgDistanceMeters === null && b.avgDistanceMeters === null) return a.name.localeCompare(b.name);
    if (a.avgDistanceMeters === null) return 1;
    if (b.avgDistanceMeters === null) return -1;
    return a.avgDistanceMeters - b.avgDistanceMeters;
  });

  return results.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Per-officer operational figures for the Officer Management page (one pass over open work). */
async function officerOverview({ search, departmentId, status } = {}) {
  const clauses = ["u.role = 'OFFICER'"];
  const params = [];
  if (departmentId) { clauses.push('u.department_id = ?'); params.push(Number(departmentId)); }
  if (status === 'active') clauses.push('u.is_active = TRUE');
  if (status === 'inactive') clauses.push('u.is_active = FALSE');
  if (search) {
    clauses.push('(u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.department_id, u.ward_id, u.is_active, u.created_at,
            d.name AS department_name, d.code AS department_code, d.is_active AS department_active, w.ward_name,
            COALESCE(SUM(c.id IS NOT NULL AND c.status NOT IN ('RESOLVED', 'REJECTED')), 0) AS active_assignments,
            COALESCE(SUM(c.status NOT IN ('RESOLVED', 'REJECTED') AND c.priority_level = 'CRITICAL'), 0) AS critical_assignments,
            COALESCE(SUM(c.status NOT IN ('RESOLVED', 'REJECTED') AND c.sla_status = 'BREACHED'), 0) AS sla_breaches
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN wards w ON w.id = u.ward_id
     LEFT JOIN complaints c ON c.officer_id = u.id
     WHERE ${clauses.join(' AND ')}
     GROUP BY u.id, u.name, u.email, u.phone, u.department_id, u.ward_id, u.is_active, u.created_at, d.name, d.code, d.is_active, w.ward_name
     ORDER BY u.is_active DESC, d.name, u.name`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    departmentId: r.department_id,
    departmentName: r.department_name,
    departmentCode: r.department_code,
    departmentActive: r.department_active === null ? null : Boolean(r.department_active),
    wardId: r.ward_id,
    wardName: r.ward_name,
    isActive: Boolean(r.is_active),
    activeAssignments: Number(r.active_assignments),
    criticalAssignments: Number(r.critical_assignments),
    slaBreaches: Number(r.sla_breaches),
    createdAt: r.created_at,
  }));
}

module.exports = { recommendOfficers, officerOverview };
