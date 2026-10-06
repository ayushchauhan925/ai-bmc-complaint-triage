const { pool } = require('../config/db');

/**
 * Feedback the citizen gave for the complaint's *current* resolution. A complaint's resolved_at is reset every
 * time it is resolved again, so feedback from an earlier (reopened) cycle is ignored and a fresh resolution can
 * collect fresh feedback. Returns null when the complaint is not currently resolved or has no feedback yet.
 */
async function findForCurrentResolution(complaint) {
  if (complaint.status !== 'RESOLVED' || !complaint.resolved_at) return null;
  const [rows] = await pool.query(
    'SELECT id, resolved, rating, comment, created_at FROM feedback WHERE complaint_id = ? AND created_at >= DATE_SUB(?, INTERVAL 1 SECOND) ORDER BY id DESC LIMIT 1',
    [complaint.id, complaint.resolved_at]
  );
  if (!rows[0]) return null;
  return { id: rows[0].id, resolved: Boolean(rows[0].resolved), rating: rows[0].rating, comment: rows[0].comment, created_at: rows[0].created_at };
}

module.exports = { findForCurrentResolution };
