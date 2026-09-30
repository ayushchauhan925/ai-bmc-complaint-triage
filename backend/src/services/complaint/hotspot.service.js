const { pool } = require('../../config/db');
const { haversineDistanceMeters } = require('../../utils/vectorMath');
const { HOTSPOT_DETECTION, HOTSPOT_V2 } = require('../../utils/constants');
const { dbscan, centroidOf, radiusOf } = require('../../utils/geo');

/**
 * Deterministic hotspot detection (Section 7): greedy geographic/time/category clustering
 * over recent, unresolved complaints - no ML model, just proximity + a minimum count. This
 * is a lightweight heuristic over demo/live data, not an official BMC analysis.
 */
async function detectHotspots({
  radiusMeters = HOTSPOT_DETECTION.radiusMeters,
  timeWindowHours = HOTSPOT_DETECTION.timeWindowHours,
  minComplaints = HOTSPOT_DETECTION.minComplaintsForHotspot,
} = {}) {
  const [rows] = await pool.query(
    `SELECT id, complaint_number, category, priority_level, latitude, longitude, created_at, status
     FROM complaints
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       AND status NOT IN ('RESOLVED', 'REJECTED')
     ORDER BY created_at DESC`,
    [timeWindowHours]
  );

  const unclustered = [...rows];
  const clusters = [];

  while (unclustered.length > 0) {
    const seed = unclustered.shift();
    const members = [seed];

    for (let i = unclustered.length - 1; i >= 0; i -= 1) {
      const candidate = unclustered[i];
      if (candidate.category !== seed.category) continue;
      const distance = haversineDistanceMeters(
        Number(seed.latitude),
        Number(seed.longitude),
        Number(candidate.latitude),
        Number(candidate.longitude)
      );
      if (distance <= radiusMeters) {
        members.push(candidate);
        unclustered.splice(i, 1);
      }
    }

    if (members.length >= minComplaints) {
      const centroidLat = members.reduce((sum, m) => sum + Number(m.latitude), 0) / members.length;
      const centroidLng = members.reduce((sum, m) => sum + Number(m.longitude), 0) / members.length;
      const priorityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const dominantPriority = members.reduce((top, m) =>
        priorityRank[m.priority_level] > priorityRank[top] ? m.priority_level : top
      , 'LOW');
      const times = members.map((m) => new Date(m.created_at).getTime());

      clusters.push({
        category: seed.category,
        complaintCount: members.length,
        centroid: { latitude: Number(centroidLat.toFixed(7)), longitude: Number(centroidLng.toFixed(7)) },
        dominantPriority,
        radiusMeters,
        timeRange: { from: new Date(Math.min(...times)).toISOString(), to: new Date(Math.max(...times)).toISOString() },
        complaintIds: members.map((m) => m.id),
        complaintNumbers: members.map((m) => m.complaint_number),
      });
    }
  }

  clusters.sort((a, b) => b.complaintCount - a.complaintCount);
  return clusters;
}

const OPEN_STATUSES_SQL = "('RESOLVED', 'REJECTED')";
const PRIORITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

// Builds the shared WHERE clause for hotspot/heatmap queries from user-facing filters.
// Everything is parameterised - filter values never reach the SQL text.
function buildGeoFilter(f = {}) {
  const clauses = ['latitude IS NOT NULL', 'longitude IS NOT NULL'];
  const params = [];
  if (f.dateFrom) { clauses.push('created_at >= ?'); params.push(f.dateFrom); }
  else { clauses.push('created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)'); params.push(Math.min(Math.max(Number(f.days) || HOTSPOT_V2.defaultDays, 1), 365)); }
  if (f.dateTo) { clauses.push('created_at <= ?'); params.push(f.dateTo); }
  if (f.category) { clauses.push('category = ?'); params.push(f.category); }
  if (f.departmentId) { clauses.push('department_id = ?'); params.push(Number(f.departmentId)); }
  if (f.priority && f.priority.length) {
    const list = [].concat(f.priority);
    clauses.push(`priority_level IN (${list.map(() => '?').join(',')})`); params.push(...list);
  }
  if (f.status === 'open') clauses.push(`status NOT IN ${OPEN_STATUSES_SQL}`);
  else if (f.status === 'closed') clauses.push(`status IN ${OPEN_STATUSES_SQL}`);
  else if (f.status) { clauses.push('status = ?'); params.push(f.status); }
  return { where: clauses.join(' AND '), params };
}

/**
 * Hotspot engine v2: density-based (DBSCAN) clustering with per-cluster civic metrics.
 * Deterministic and explainable - the score formula and every component are returned.
 *
 *   hotspotScore = severityWeightedCount x (1 + recentShare) x (0.5 + 0.5 x unresolvedShare)
 *
 * Clusters are per category by default (a pothole hotspot and a garbage hotspot on the same
 * street are different problems); pass mixedCategories to cluster everything together.
 */
async function detectHotspotsAdvanced(filters = {}) {
  const { where, params } = buildGeoFilter(filters);
  const [rows] = await pool.query(
    `SELECT id, complaint_number, category, priority_level, status, incident_id, department_id, latitude, longitude, created_at
     FROM complaints WHERE ${where} ORDER BY created_at DESC LIMIT 5000`,
    params
  );

  const radius = Number(filters.radiusMeters) || HOTSPOT_V2.radiusMeters;
  const minPts = Number(filters.minComplaints) || HOTSPOT_V2.minComplaints;
  const now = Date.now();

  const groups = new Map();
  for (const r of rows) {
    const key = filters.mixedCategories ? 'ALL' : r.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...r, latitude: Number(r.latitude), longitude: Number(r.longitude) });
  }

  const hotspots = [];
  for (const [groupKey, points] of groups) {
    const { clusters } = dbscan(points, radius, minPts);
    for (const members of clusters) {
      const centre = centroidOf(members);
      const spread = radiusOf(members, centre);
      const areaKm2 = Math.max(Math.PI * (Math.max(spread, 50) / 1000) ** 2, 0.008);
      const weights = members.map((m) => HOTSPOT_V2.severityWeight[m.priority_level] || 1);
      const severityWeighted = weights.reduce((a, b) => a + b, 0);
      const unresolved = members.filter((m) => !['RESOLVED', 'REJECTED'].includes(m.status)).length;
      const recent = members.filter((m) => now - new Date(m.created_at).getTime() <= HOTSPOT_V2.recentHours * 3600 * 1000).length;
      const recentShare = recent / members.length;
      const unresolvedShare = unresolved / members.length;
      const catCounts = {};
      for (const m of members) catCounts[m.category] = (catCounts[m.category] || 0) + 1;
      const dominantCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0];
      const times = members.map((m) => new Date(m.created_at).getTime());
      const score = severityWeighted * (1 + recentShare) * (0.5 + 0.5 * unresolvedShare);

      hotspots.push({
        id: `${groupKey}-${Number(centre.latitude).toFixed(4)}-${Number(centre.longitude).toFixed(4)}`,
        category: dominantCategory,
        label: `${dominantCategory.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())} hotspot`,
        complaintCount: members.length,
        centroid: { latitude: Number(centre.latitude.toFixed(6)), longitude: Number(centre.longitude.toFixed(6)) },
        radiusMeters: Math.round(Math.max(spread, 50)),
        areaKm2: Number(areaKm2.toFixed(3)),
        densityPerKm2: Number((members.length / areaKm2).toFixed(1)),
        severityDensity: Number((severityWeighted / areaKm2).toFixed(1)),
        severityWeightedCount: severityWeighted,
        unresolvedCount: unresolved,
        unresolvedShare: Number(unresolvedShare.toFixed(2)),
        recentCount: recent,
        recentShare: Number(recentShare.toFixed(2)),
        incidentCount: new Set(members.map((m) => m.incident_id).filter(Boolean)).size,
        dominantPriority: members.reduce((top, m) => (PRIORITY_RANK[m.priority_level] > PRIORITY_RANK[top] ? m.priority_level : top), 'LOW'),
        score: Number(score.toFixed(1)),
        scoreComponents: { severityWeightedCount: severityWeighted, recentShare: Number(recentShare.toFixed(2)), unresolvedShare: Number(unresolvedShare.toFixed(2)) },
        timeRange: { from: new Date(Math.min(...times)).toISOString(), to: new Date(Math.max(...times)).toISOString() },
        complaintIds: members.map((m) => m.id),
      });
    }
  }

  hotspots.sort((a, b) => b.score - a.score);
  return { hotspots, evaluatedComplaints: rows.length, radiusMeters: radius, minComplaints: minPts, filters: { ...filters } };
}

/** Weighted points for a heatmap layer: [lat, lng, weight 0..1]. Severity-weighted, filterable. */
async function getHeatmapPoints(filters = {}) {
  const { where, params } = buildGeoFilter(filters);
  const [rows] = await pool.query(
    `SELECT latitude, longitude, priority_level, status FROM complaints WHERE ${where} LIMIT 5000`,
    params
  );
  const max = Math.max(...Object.values(HOTSPOT_V2.severityWeight));
  const points = rows.map((r) => {
    const w = (HOTSPOT_V2.severityWeight[r.priority_level] || 1) / max;
    const open = !['RESOLVED', 'REJECTED'].includes(r.status);
    return [Number(r.latitude), Number(r.longitude), Number((open ? w : w * 0.5).toFixed(2))];
  });
  return { points, count: points.length, filters: { ...filters } };
}

module.exports = { detectHotspots, detectHotspotsAdvanced, getHeatmapPoints };
