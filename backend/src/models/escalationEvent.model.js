const { pool } = require('../config/db');
const notificationService = require('../services/notification/notification.service');
const auditService = require('../services/audit/audit.service');
const userModel = require('./user.model');

/**
 * Creates an escalation event unless one with the same dedupe key already exists (so each
 * rule fires once per subject). Returns { created, id }. When `notify` is true, admins get
 * an in-app notification for a newly created event.
 */
async function create({ ruleCode, severity, complaintId = null, incidentId = null, departmentId = null, title, details = null, dedupeKey, notify = true }) {
  const [result] = await pool.query(
    `INSERT IGNORE INTO escalation_events
       (rule_code, severity, complaint_id, incident_id, department_id, title, details, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [ruleCode, severity, complaintId, incidentId, departmentId, title.slice(0, 255), details ? JSON.stringify(details) : null, dedupeKey]
  );
  if (result.affectedRows === 0) return { created: false, id: null };

  await auditService.record({
    actor: null,
    action: 'ESCALATION_RAISED',
    entityType: complaintId ? 'complaint' : incidentId ? 'incident' : 'system',
    entityId: complaintId || incidentId || null,
    next: { ruleCode, severity, title },
  });

  if (notify) {
    const admins = await userModel.listByRole('ADMIN');
    for (const admin of admins) {
      await notificationService.notify({
        userId: admin.id,
        title: `Escalation: ${title}`.slice(0, 250),
        message: `${ruleCode.replace(/_/g, ' ').toLowerCase()} - severity ${severity}`,
        type: 'ESCALATION',
        relatedComplaintId: complaintId,
      });
    }
  }
  return { created: true, id: result.insertId };
}

async function list({ status, ruleCode, limit = 100 } = {}) {
  const clauses = [];
  const params = [];
  if (status) { clauses.push('e.status = ?'); params.push(status); }
  if (ruleCode) { clauses.push('e.rule_code = ?'); params.push(ruleCode); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT e.*, c.complaint_number, i.incident_number, d.name AS department_name
     FROM escalation_events e
     LEFT JOIN complaints c ON c.id = e.complaint_id
     LEFT JOIN incidents i ON i.id = e.incident_id
     LEFT JOIN departments d ON d.id = e.department_id
     ${where}
     ORDER BY FIELD(e.status, 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'), e.created_at DESC
     LIMIT ?`,
    [...params, Math.min(Number(limit) || 100, 300)]
  );
  return rows;
}

async function acknowledge(id, userId) {
  const [result] = await pool.query(
    "UPDATE escalation_events SET status = 'ACKNOWLEDGED', acknowledged_by = ? WHERE id = ? AND status = 'OPEN'",
    [userId, id]
  );
  return result.affectedRows > 0;
}

/** Closes events whose subject (complaint/incident) has since been resolved. */
async function autoResolve() {
  const [a] = await pool.query(
    `UPDATE escalation_events e JOIN complaints c ON c.id = e.complaint_id
     SET e.status = 'RESOLVED', e.resolved_at = NOW()
     WHERE e.status IN ('OPEN', 'ACKNOWLEDGED') AND c.status IN ('RESOLVED', 'REJECTED')`
  );
  const [b] = await pool.query(
    `UPDATE escalation_events e JOIN incidents i ON i.id = e.incident_id
     SET e.status = 'RESOLVED', e.resolved_at = NOW()
     WHERE e.status IN ('OPEN', 'ACKNOWLEDGED') AND e.complaint_id IS NULL AND i.status IN ('RESOLVED', 'CLOSED')`
  );
  return a.affectedRows + b.affectedRows;
}

async function summary() {
  const [rows] = await pool.query(
    `SELECT rule_code, status, COUNT(*) AS cnt FROM escalation_events GROUP BY rule_code, status`
  );
  return rows.map((r) => ({ ruleCode: r.rule_code, status: r.status, count: Number(r.cnt) }));
}

module.exports = { create, list, acknowledge, autoResolve, summary };
