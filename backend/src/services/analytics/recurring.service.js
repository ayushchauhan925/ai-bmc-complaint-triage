const { pool } = require('../../config/db');
const { dbscan, centroidOf, radiusOf } = require('../../utils/geo');

/**
 * Recurring problems: places where the same kind of complaint keeps coming back after it was
 * resolved. Deterministic - DBSCAN per category, then simple counts from stored data.
 *
 *   interventions          = complaints in the cluster that were resolved
 *   recurredAfterResolution = complaints reported AFTER the cluster's first resolution
 *   status ACTIVE          = at least one complaint in the cluster is still open
 */
async function getRecurringProblems({ days = 180, radiusMeters = 150, minReports = 3 } = {}) {
  const safeDays = Math.min(Math.max(Number(days) || 180, 14), 730);
  const [rows] = await pool.query(
    `SELECT c.id, c.complaint_number, c.category, c.status, c.incident_id, c.latitude, c.longitude, c.address,
            c.created_at, c.resolved_at,
            (SELECT COUNT(*) FROM complaint_reopenings r WHERE r.complaint_id = c.id) AS reopenings
     FROM complaints c
     WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND c.status <> 'REJECTED'
     ORDER BY c.created_at DESC LIMIT 5000`,
    [safeDays]
  );

  const byCategory = new Map();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category).push({ ...r, latitude: Number(r.latitude), longitude: Number(r.longitude) });
  }

  const problems = [];
  for (const [category, points] of byCategory) {
    const { clusters } = dbscan(points, radiusMeters, minReports);
    for (const m of clusters) {
      const resolved = m.filter((x) => x.status === 'RESOLVED' && x.resolved_at);
      if (resolved.length === 0) continue; // never fixed -> an open problem, not a *recurring* one
      const firstResolvedAt = Math.min(...resolved.map((x) => new Date(x.resolved_at).getTime()));
      const after = m.filter((x) => new Date(x.created_at).getTime() > firstResolvedAt);
      if (after.length === 0) continue; // fixed and stayed fixed
      const open = m.filter((x) => !['RESOLVED', 'REJECTED'].includes(x.status));
      const centre = centroidOf(m);
      const times = m.map((x) => new Date(x.created_at).getTime());
      const withAddress = m.find((x) => x.address);

      problems.push({
        id: `${category}-${centre.latitude.toFixed(4)}-${centre.longitude.toFixed(4)}`,
        category,
        location: { latitude: Number(centre.latitude.toFixed(6)), longitude: Number(centre.longitude.toFixed(6)), radiusMeters: Math.round(Math.max(radiusOf(m, centre), 30)) },
        landmark: withAddress?.address || null,
        reports: m.length,
        incidents: new Set(m.map((x) => x.incident_id).filter(Boolean)).size,
        interventions: resolved.length,
        recurredAfterResolution: after.length,
        reopenings: m.reduce((s, x) => s + Number(x.reopenings || 0), 0),
        openNow: open.length,
        status: open.length > 0 ? 'ACTIVE' : 'QUIET',
        firstReportedAt: new Date(Math.min(...times)).toISOString(),
        latestReportedAt: new Date(Math.max(...times)).toISOString(),
        firstResolvedAt: new Date(firstResolvedAt).toISOString(),
        complaintNumbers: m.map((x) => x.complaint_number).slice(0, 12),
      });
    }
  }

  problems.sort((a, b) => b.recurredAfterResolution - a.recurredAfterResolution || b.reports - a.reports);
  return { windowDays: safeDays, radiusMeters, minReports, problems };
}

const median = (arr) => {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Resolution effectiveness: for each resolved location, compare complaints of the same
 * category within `radiusMeters` in the `windowDays` BEFORE the first resolution and the
 * `windowDays` AFTER it. This is an *observed* before/after comparison only - it does not
 * show the fix caused the change (season, reporting habits and other work also move counts).
 * Locations with too few earlier reports, or without a complete "after" window, are skipped.
 */
async function getEffectiveness({ windowDays = 30, radiusMeters = 200, minBefore = 3 } = {}) {
  const w = Math.min(Math.max(Number(windowDays) || 30, 7), 90);
  const [resolved] = await pool.query(
    `SELECT id, category, latitude, longitude, resolved_at FROM complaints
     WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL
       AND resolved_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY resolved_at ASC LIMIT 3000`,
    [w]
  );

  const byCategory = new Map();
  for (const r of resolved) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category).push({ ...r, latitude: Number(r.latitude), longitude: Number(r.longitude) });
  }

  const results = [];
  for (const [category, points] of byCategory) {
    // minPts 1 => connected groups of resolved complaints that are close together = one location.
    const { clusters } = dbscan(points, radiusMeters, 1);
    for (const m of clusters) {
      const centre = centroidOf(m);
      const t = new Date(Math.min(...m.map((x) => new Date(x.resolved_at).getTime())));
      const latDelta = radiusMeters / 111000;
      const lonDelta = radiusMeters / (111000 * Math.cos((centre.latitude * Math.PI) / 180) || 1);
      const [[counts]] = await pool.query(
        `SELECT COALESCE(SUM(created_at >= DATE_SUB(?, INTERVAL ? DAY) AND created_at < ?), 0) AS before_cnt,
                COALESCE(SUM(created_at > ? AND created_at <= DATE_ADD(?, INTERVAL ? DAY)), 0) AS after_cnt
         FROM complaints
         WHERE category = ? AND status <> 'REJECTED'
           AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
           AND created_at >= DATE_SUB(?, INTERVAL ? DAY) AND created_at <= DATE_ADD(?, INTERVAL ? DAY)`,
        [t, w, t, t, t, w, category, centre.latitude - latDelta, centre.latitude + latDelta, centre.longitude - lonDelta, centre.longitude + lonDelta, t, w, t, w]
      );
      const before = Number(counts.before_cnt);
      const after = Number(counts.after_cnt);
      if (before < minBefore) continue;
      results.push({
        id: `${category}-${centre.latitude.toFixed(4)}-${centre.longitude.toFixed(4)}`,
        category,
        location: { latitude: Number(centre.latitude.toFixed(6)), longitude: Number(centre.longitude.toFixed(6)) },
        resolvedAt: t.toISOString(),
        resolvedComplaints: m.length,
        before,
        after,
        changePct: Math.round(((after - before) / before) * 100),
      });
    }
  }

  results.sort((a, b) => a.changePct - b.changePct);
  const changes = results.map((r) => r.changePct);
  return {
    windowDays: w,
    radiusMeters,
    minBefore,
    locationsEvaluated: results.length,
    summary: {
      medianChangePct: median(changes),
      reducedCount: results.filter((r) => r.after < r.before).length,
      unchangedCount: results.filter((r) => r.after === r.before).length,
      increasedCount: results.filter((r) => r.after > r.before).length,
    },
    results,
    caveat: 'Observed before/after comparison of complaint counts. It does not prove the fix caused the change: season, reporting habits and other works also affect counts.',
  };
}

module.exports = { getRecurringProblems, getEffectiveness };
