const { pool } = require('../../config/db');
const incidentModel = require('../../models/incident.model');
const priorityService = require('../complaint/priority.service');
const { haversineDistanceMeters } = require('../../utils/vectorMath');
const { DUPLICATE_DETECTION, INCIDENT_ESCALATION } = require('../../utils/constants');

function durationBonus(ageHours) {
  const bracket = INCIDENT_ESCALATION.duration.find((b) => ageHours >= b.hoursMin && ageHours < b.hoursMax);
  return bracket ? bracket.score : 0;
}

/**
 * Incident severity escalation (Section 6): layers two deterministic bonuses on top of the
 * base priority already computed from category/signals/duplicate-count -
 *  - geographic concentration: how tightly clustered the linked complaints are (tighter =
 *    more likely a single real-world issue, not coincidental proximity)
 *  - duration: how long the incident has been open and unresolved
 * The LLM has no input into this number.
 */
async function calculateEscalatedPriority(incidentId, baseScore) {
  const incident = await incidentModel.findById(incidentId);
  const linkedComplaints = await incidentModel.getLinkedComplaints(incidentId);

  let concentrationBonus = 0;
  if (linkedComplaints.length > 1) {
    const centroidLat = linkedComplaints.reduce((s, c) => s + Number(c.latitude), 0) / linkedComplaints.length;
    const centroidLng = linkedComplaints.reduce((s, c) => s + Number(c.longitude), 0) / linkedComplaints.length;
    const avgDistance =
      linkedComplaints.reduce(
        (s, c) => s + haversineDistanceMeters(centroidLat, centroidLng, Number(c.latitude), Number(c.longitude)),
        0
      ) / linkedComplaints.length;
    const concentrationRatio = Math.max(0, 1 - avgDistance / DUPLICATE_DETECTION.searchRadiusMeters);
    concentrationBonus = Math.round(concentrationRatio * INCIDENT_ESCALATION.concentrationMaxBonus);
  }

  const ageHours = (Date.now() - new Date(incident.created_at).getTime()) / (1000 * 60 * 60);
  const ageBonus = durationBonus(ageHours);

  const finalScore = Math.min(baseScore + concentrationBonus + ageBonus, 100);
  return { score: finalScore, level: priorityService.levelForScore(finalScore), concentrationBonus, ageBonus };
}

/**
 * Groups a newly analyzed complaint together with any related complaints found by
 * duplicateDetection.service into a single Incident (Section 12). Reuses an existing
 * incident if any related complaint already belongs to one.
 */
async function groupComplaintIntoIncident({ complaint, relatedResults, departmentId }) {
  if (relatedResults.length < DUPLICATE_DETECTION.minRelatedForIncident) {
    return { incidentId: null, relatedCount: relatedResults.length };
  }

  const relatedIds = relatedResults.map((r) => r.complaint.id);
  const existingIncidentId = await incidentModel.findIncidentIdForAnyComplaint(relatedIds);

  const conn = await pool.getConnection();
  let incidentId = existingIncidentId;
  try {
    await conn.beginTransaction();

    if (!incidentId) {
      const title = `${complaint.category.replace(/_/g, ' ')} - ${complaint.address || 'reported location'}`;
      const created = await incidentModel.create(conn, {
        title,
        category: complaint.category,
        latitude: complaint.latitude,
        longitude: complaint.longitude,
        departmentId,
        priorityScore: complaint.priority_score || 0,
        priorityLevel: complaint.priority_level || 'LOW',
      });
      incidentId = created.id;
    }

    await incidentModel.linkComplaint(conn, incidentId, complaint.id);
    for (const relatedId of relatedIds) {
      await incidentModel.linkComplaint(conn, incidentId, relatedId);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const incident = await incidentModel.findById(incidentId);
  const recomputed = priorityService.calculatePriority({
    category: complaint.category,
    severitySignals: complaint.severity_signals || {},
    relatedComplaintCount: incident.complaint_count,
    createdAt: incident.created_at,
  });
  const escalated = await calculateEscalatedPriority(incidentId, recomputed.score);
  await incidentModel.updatePriority(incidentId, escalated.score, escalated.level);

  return { incidentId, relatedCount: relatedResults.length };
}

module.exports = { groupComplaintIntoIncident };
