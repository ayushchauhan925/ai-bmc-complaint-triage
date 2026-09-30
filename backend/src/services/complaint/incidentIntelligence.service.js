const { pool } = require('../../config/db');
const { haversineDistanceMeters } = require('../../utils/vectorMath');
const slaService = require('./sla.service');

const RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const SLA_RANK = { BREACHED: 4, APPROACHING: 3, ON_TRACK: 2, COMPLETED_AFTER_SLA: 1, COMPLETED_WITHIN_SLA: 0 };
const HOUR = 3600 * 1000;

/**
 * Trend of an incident from its complaints' timestamps: reports in the last 24 h versus the
 * 24 h before. Reported honestly - with too few reports it says so instead of guessing.
 */
function computeTrend(createdAts, now = Date.now()) {
  if (createdAts.length < 3) return { label: 'INSUFFICIENT_DATA', last24h: null, previous24h: null };
  const times = createdAts.map((d) => new Date(d).getTime());
  const last = times.filter((t) => now - t <= 24 * HOUR).length;
  const prev = times.filter((t) => now - t > 24 * HOUR && now - t <= 48 * HOUR).length;
  let label = 'STABLE';
  if (last > prev && last - prev >= 1 && last >= prev * 1.5) label = 'RISING';
  else if (last < prev && prev - last >= 1 && last <= prev * 0.5) label = 'FALLING';
  return { label, last24h: last, previous24h: prev };
}

/** Geographic extent: centroid, bounding box and the radius that contains every complaint. */
function computeExtent(points) {
  if (points.length === 0) return null;
  const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
  const radius = Math.max(...points.map((p) => haversineDistanceMeters(lat, lng, p.latitude, p.longitude)));
  return {
    centroid: { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) },
    radiusMeters: Math.round(radius),
    bounds: {
      minLat: Math.min(...points.map((p) => p.latitude)),
      maxLat: Math.max(...points.map((p) => p.latitude)),
      minLng: Math.min(...points.map((p) => p.longitude)),
      maxLng: Math.max(...points.map((p) => p.longitude)),
    },
  };
}

/** Everything an incident command view needs, derived from stored complaint/escalation data. */
async function getIncidentIntelligence(incident, complaints) {
  const points = complaints.map((c) => ({ latitude: Number(c.latitude), longitude: Number(c.longitude) }));
  const categoryCounts = {};
  for (const c of complaints) categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;

  const times = complaints.map((c) => new Date(c.created_at).getTime());
  const worstSeverity = complaints.reduce((top, c) => (RANK[c.priority_level] > RANK[top] ? c.priority_level : top), 'LOW');

  const slaSnapshots = complaints.map((c) => slaService.slaSnapshot(c));
  const worstSla = slaSnapshots.reduce((top, s) => (SLA_RANK[s.status] > SLA_RANK[top] ? s.status : top), 'COMPLETED_WITHIN_SLA');
  const openComplaints = complaints.filter((c) => !['RESOLVED', 'REJECTED'].includes(c.status));
  const nextDeadline = openComplaints
    .map((c) => c.sla_deadline)
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b))[0] || null;

  const [escalations] = await pool.query(
    `SELECT id, rule_code, severity, title, status, created_at FROM escalation_events
     WHERE incident_id = ? OR complaint_id IN (${complaints.length ? complaints.map(() => '?').join(',') : 'NULL'})
     ORDER BY created_at DESC LIMIT 20`,
    [incident.id, ...complaints.map((c) => c.id)]
  );

  return {
    complaintCount: complaints.length,
    openComplaintCount: openComplaints.length,
    categories: Object.entries(categoryCounts).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    severity: worstSeverity,
    firstReportedAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
    latestReportedAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
    trend: computeTrend(complaints.map((c) => c.created_at)),
    extent: computeExtent(points),
    sla: {
      worstStatus: worstSla,
      breachedCount: slaSnapshots.filter((s) => s.status === 'BREACHED').length,
      nextDeadline,
    },
    escalation: {
      openCount: escalations.filter((e) => e.status === 'OPEN').length,
      events: escalations,
    },
  };
}

module.exports = { getIncidentIntelligence, computeTrend, computeExtent };
