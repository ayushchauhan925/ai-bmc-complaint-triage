const { pool } = require('../../config/db');
const complaintModel = require('../../models/complaint.model');
const logger = require('../../utils/logger');
const metrics = require('../observability/metrics.service');

const EVENT_TYPES = {
  CREATED: 'CREATED',
  AI_ANALYZED: 'AI_ANALYZED',
  AI_FAILED: 'AI_FAILED',
  DEPARTMENT_ASSIGNED: 'DEPARTMENT_ASSIGNED',
  PRIORITY_SET: 'PRIORITY_SET',
  EVIDENCE_SCORED: 'EVIDENCE_SCORED',
  DUPLICATE_DETECTED: 'DUPLICATE_DETECTED',
  INCIDENT_LINKED: 'INCIDENT_LINKED',
  IMAGE_ANALYZED: 'IMAGE_ANALYZED',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  SLA_WARNING: 'SLA_WARNING',
  SLA_BREACHED: 'SLA_BREACHED',
  ESCALATED: 'ESCALATED',
};

/** Records a timeline event. Never throws - the timeline is observability, not a gate. */
async function recordEvent(complaintId, type, title, { details = null, actorId = null, visibility = 'STAFF' } = {}) {
  try {
    await pool.query(
      `INSERT INTO complaint_events (complaint_id, event_type, title, details, actor_id, visibility)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [complaintId, type, String(title).slice(0, 255), details ? JSON.stringify(details) : null, actorId, visibility]
    );
  } catch (err) {
    metrics.recordError('database', `timeline insert failed: ${err.message}`);
    logger.warn('Failed to record complaint timeline event.', { complaintId, type, error: err.message });
  }
}

const STATUS_LABELS = {
  SUBMITTED: 'Complaint submitted',
  AI_ANALYZED: 'AI analysis completed',
  ASSIGNED: 'Assigned to department',
  IN_PROGRESS: 'Work started',
  RESOLUTION_SUBMITTED: 'Resolution submitted for approval',
  RESOLVED: 'Resolved',
  NEEDS_REVIEW: 'Flagged for manual review',
  REJECTED: 'Closed after review',
  REOPENED: 'Reopened',
};

/**
 * Unified, chronological timeline: status history (the authoritative status trail) merged
 * with complaint_events (everything else). Citizens only get PUBLIC events, with internal
 * notes and staff-only events removed.
 */
async function getTimeline(complaintId, { forCitizen = false } = {}) {
  const [history, [events]] = await Promise.all([
    complaintModel.getHistory(complaintId),
    pool.query('SELECT * FROM complaint_events WHERE complaint_id = ? ORDER BY created_at ASC, id ASC', [complaintId]),
  ]);

  const items = [];
  for (const h of history) {
    items.push({
      kind: 'STATUS',
      type: h.new_status,
      title: STATUS_LABELS[h.new_status] || `Status: ${h.new_status}`,
      detail: forCitizen ? null : h.notes,
      actor: forCitizen ? null : h.actor_name || null,
      at: h.created_at,
      visibility: 'PUBLIC',
    });
  }
  for (const e of events) {
    if (forCitizen && e.visibility !== 'PUBLIC') continue;
    items.push({
      kind: 'EVENT',
      type: e.event_type,
      title: e.title,
      detail: forCitizen ? null : e.details,
      actor: null,
      at: e.created_at,
      visibility: e.visibility,
    });
  }
  items.sort((a, b) => new Date(a.at) - new Date(b.at));
  return items;
}

module.exports = { EVENT_TYPES, recordEvent, getTimeline };
