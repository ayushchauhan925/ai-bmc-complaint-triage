const { pool } = require('../../config/db');
const { haversineDistanceMeters } = require('../../utils/vectorMath');
const { HOTSPOT_DETECTION } = require('../../utils/constants');

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

module.exports = { detectHotspots };
