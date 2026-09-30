const { pool } = require('../../config/db');
const escalationEventModel = require('../../models/escalationEvent.model');
const anomalyService = require('../analytics/anomaly.service');
const escalationService = require('./escalation.service');
const timeline = require('./timeline.service');
const { dbscan, centroidOf } = require('../../utils/geo');
const { ESCALATION_RULES } = require('../../utils/constants');

/**
 * Deterministic escalation rules beyond SLA thresholds. Each rule is a plain query/threshold
 * over stored data with a dedupe key, so a given situation escalates once and every
 * escalation can be traced to the exact rule and numbers that produced it. The LLM has no
 * role here.
 *
 *   SLA_APPROACHING / SLA_BREACHED   (escalation.service.js)
 *   HIGH_SEVERITY_UNASSIGNED         critical/high complaint waiting for an officer too long
 *   REPEATED_COMPLAINTS              same problem keeps coming back at the same place
 *   MAJOR_INCIDENT                   incident cluster crossed a size threshold
 *   SURGE_*                          statistical anomaly from anomaly.service.js
 */

async function ruleHighSeverityUnassigned() {
  let raised = 0;
  for (const [level, hours] of Object.entries(ESCALATION_RULES.unassignedHours)) {
    const [rows] = await pool.query(
      `SELECT id, complaint_number, category, department_id, created_at FROM complaints
       WHERE priority_level = ? AND officer_id IS NULL
         AND status NOT IN ('RESOLVED', 'REJECTED')
         AND created_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [level, hours]
    );
    for (const c of rows) {
      const r = await escalationEventModel.create({
        ruleCode: 'HIGH_SEVERITY_UNASSIGNED',
        severity: level === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        complaintId: c.id,
        departmentId: c.department_id,
        title: `${level} complaint ${c.complaint_number} still has no officer after ${hours} h`,
        details: { priority: level, thresholdHours: hours, category: c.category },
        dedupeKey: `unassigned:${c.id}`,
      });
      if (r.created) {
        raised += 1;
        await timeline.recordEvent(c.id, timeline.EVENT_TYPES.ESCALATED, `Escalated: no officer assigned after ${hours} h`, { details: { rule: 'HIGH_SEVERITY_UNASSIGNED' } });
      }
    }
  }
  return raised;
}

async function ruleRepeatedComplaints() {
  const { minReports, days, radiusMeters } = ESCALATION_RULES.repeat;
  const [rows] = await pool.query(
    `SELECT id, complaint_number, category, status, department_id, latitude, longitude FROM complaints
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND status <> 'REJECTED'`,
    [days]
  );
  const byCategory = new Map();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category).push({ ...r, latitude: Number(r.latitude), longitude: Number(r.longitude) });
  }

  let raised = 0;
  for (const [category, points] of byCategory) {
    const { clusters } = dbscan(points, radiusMeters, minReports);
    for (const members of clusters) {
      const resolved = members.filter((m) => m.status === 'RESOLVED').length;
      const open = members.filter((m) => !['RESOLVED', 'REJECTED'].includes(m.status));
      // "Repeated" = it was fixed (or reported/closed) before and is open again.
      if (resolved === 0 || open.length === 0) continue;
      const centre = centroidOf(members);
      const r = await escalationEventModel.create({
        ruleCode: 'REPEATED_COMPLAINTS',
        severity: 'HIGH',
        complaintId: null,
        departmentId: open[0].department_id,
        title: `Recurring ${category.replace(/_/g, ' ').toLowerCase()} problem: ${members.length} reports in ${days} days at one location`,
        details: {
          category,
          reports: members.length,
          resolvedBefore: resolved,
          openNow: open.length,
          location: { latitude: Number(centre.latitude.toFixed(5)), longitude: Number(centre.longitude.toFixed(5)) },
          complaintNumbers: members.map((m) => m.complaint_number).slice(0, 10),
        },
        dedupeKey: `repeat:${category}:${centre.latitude.toFixed(3)}:${centre.longitude.toFixed(3)}`,
      });
      if (r.created) raised += 1;
    }
  }
  return raised;
}

async function ruleMajorIncidents() {
  const min = ESCALATION_RULES.majorIncident.minComplaints;
  const [rows] = await pool.query(
    `SELECT id, incident_number, title, complaint_count, priority_level, department_id FROM incidents
     WHERE status IN ('OPEN', 'IN_PROGRESS') AND complaint_count >= ?`,
    [min]
  );
  let raised = 0;
  for (const i of rows) {
    const tier = i.complaint_count >= min * 2 ? min * 2 : min;
    const r = await escalationEventModel.create({
      ruleCode: 'MAJOR_INCIDENT',
      severity: tier > min ? 'CRITICAL' : 'HIGH',
      incidentId: i.id,
      departmentId: i.department_id,
      title: `Major incident ${i.incident_number}: ${i.complaint_count} complaints - ${i.title}`,
      details: { complaintCount: i.complaint_count, priority: i.priority_level, tier },
      dedupeKey: `incident:${i.id}:${tier}`,
    });
    if (r.created) raised += 1;
  }
  return raised;
}

async function ruleSurges() {
  const anomalies = await anomalyService.detectAnomalies({ force: true });
  let raised = 0;
  const today = new Date().toISOString().slice(0, 10);
  // One real-world event usually trips several detectors at once (volume, category, department,
  // severity). Department and severity surges are derivative when a volume/category surge already
  // explains them, so they are not escalated separately - the operator gets one escalation per cause.
  const primary = anomalies.anomalies.some((a) => a.type === 'VOLUME_SURGE' || a.type === 'CATEGORY_SURGE');
  for (const a of anomalies.anomalies) {
    if (a.score < ESCALATION_RULES.surgeMinScore) continue;
    if (primary && (a.type === 'DEPARTMENT_SURGE' || a.type === 'SEVERITY_SURGE')) continue;
    const r = await escalationEventModel.create({
      ruleCode: `SURGE_${a.type.replace(/_SURGE$/, '')}`,
      severity: a.score >= ESCALATION_RULES.surgeMinScore * 2 ? 'CRITICAL' : 'HIGH',
      departmentId: a.departmentId || null,
      title: `${a.label}: ${a.subject}`,
      details: { observed: a.observed, baseline: a.baseline, score: a.score, explanation: a.explanation, location: a.location || null },
      dedupeKey: `surge:${a.type}:${a.subject}:${today}`.slice(0, 120),
    });
    if (r.created) raised += 1;
  }
  return raised;
}

async function runEscalationRules() {
  const sla = await escalationService.runSlaEscalationCheck();
  const resolved = await escalationEventModel.autoResolve();
  const results = {
    sla,
    autoResolved: resolved,
    highSeverityUnassigned: await ruleHighSeverityUnassigned(),
    repeatedComplaints: await ruleRepeatedComplaints(),
    majorIncidents: await ruleMajorIncidents(),
    surges: await ruleSurges(),
  };
  return results;
}

module.exports = { runEscalationRules };
