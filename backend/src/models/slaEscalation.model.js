const { pool } = require('../config/db');

async function create({ complaintId, fromStatus, toStatus, notifiedUserId, notifiedRole }) {
  await pool.query(
    `INSERT INTO sla_escalations (complaint_id, from_sla_status, to_sla_status, notified_user_id, notified_role)
     VALUES (?, ?, ?, ?, ?)`,
    [complaintId, fromStatus || null, toStatus, notifiedUserId || null, notifiedRole || null]
  );
}

async function hasEscalation(complaintId, toStatus) {
  const [rows] = await pool.query(
    'SELECT id FROM sla_escalations WHERE complaint_id = ? AND to_sla_status = ? LIMIT 1',
    [complaintId, toStatus]
  );
  return rows.length > 0;
}

async function listForComplaint(complaintId) {
  const [rows] = await pool.query(
    'SELECT * FROM sla_escalations WHERE complaint_id = ? ORDER BY created_at DESC',
    [complaintId]
  );
  return rows;
}

async function recent(limit = 50) {
  const [rows] = await pool.query(
    `SELECT e.*, c.complaint_number, c.category, c.priority_level FROM sla_escalations e
     JOIN complaints c ON c.id = e.complaint_id
     ORDER BY e.created_at DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

module.exports = { create, hasEscalation, listForComplaint, recent };
