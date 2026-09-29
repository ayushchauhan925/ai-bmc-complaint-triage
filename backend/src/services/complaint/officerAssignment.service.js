const { pool } = require('../../config/db');
const { haversineDistanceMeters } = require('../../utils/vectorMath');

/**
 * Smart officer assignment recommendation (Section 13). Deterministic - ranks officers in
 * the target department by current workload (fewer active complaints first), then by
 * fewest current critical assignments, then by geographic proximity to the complaint if the
 * officer has other active assignments to compare against. There is no officer-availability
 * or home-base table in the schema, so proximity is approximated from their current
 * assignments' locations, not a stored officer location.
 */
async function recommendOfficers({ departmentId, latitude, longitude }) {
  const [officers] = await pool.query(
    `SELECT id, name, email FROM users WHERE role = 'OFFICER' AND department_id = ?`,
    [departmentId]
  );

  const results = [];
  for (const officer of officers) {
    const [activeRows] = await pool.query(
      `SELECT latitude, longitude, priority_level FROM complaints
       WHERE officer_id = ? AND status NOT IN ('RESOLVED', 'REJECTED')`,
      [officer.id]
    );

    const workload = activeRows.length;
    const criticalCount = activeRows.filter((r) => r.priority_level === 'CRITICAL').length;

    let nearbyAssignments = 0;
    let avgDistanceMeters = null;
    if (activeRows.length > 0 && latitude != null && longitude != null) {
      const distances = activeRows.map((r) =>
        haversineDistanceMeters(latitude, longitude, Number(r.latitude), Number(r.longitude))
      );
      nearbyAssignments = distances.filter((d) => d <= 1000).length;
      avgDistanceMeters = Math.round(distances.reduce((a, b) => a + b, 0) / distances.length);
    }

    results.push({
      officerId: officer.id,
      name: officer.name,
      email: officer.email,
      workload,
      criticalCount,
      nearbyAssignments,
      avgDistanceMeters,
    });
  }

  // Fewer active complaints first, then fewer critical assignments, then closer proximity.
  results.sort((a, b) => {
    if (a.workload !== b.workload) return a.workload - b.workload;
    if (a.criticalCount !== b.criticalCount) return a.criticalCount - b.criticalCount;
    if (a.avgDistanceMeters === null) return 1;
    if (b.avgDistanceMeters === null) return -1;
    return a.avgDistanceMeters - b.avgDistanceMeters;
  });

  return results;
}

module.exports = { recommendOfficers };
