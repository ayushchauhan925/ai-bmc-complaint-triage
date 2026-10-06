const { pool } = require('../../config/db');

const VIEWS = ['approved', 'confirmed', 'awaiting-feedback', 'not-resolved'];

// Feedback the citizen gave for a complaint's current resolution (resolved_at is reset on every re-resolution).
const CURRENT_FEEDBACK_JOIN = `LEFT JOIN feedback f ON f.id = (
  SELECT MAX(fb.id) FROM feedback fb
  WHERE fb.complaint_id = c.id AND fb.created_at >= DATE_SUB(c.resolved_at, INTERVAL 1 SECOND)
)`;

const BASE_COLUMNS = `c.id, c.complaint_number, c.ai_title, c.description, c.category, c.priority_level, c.status,
  c.created_at, c.resolved_at, u.name AS citizen_name, d.name AS department_name, o.name AS officer_name, o.email AS officer_email`;

const BASE_JOINS = `JOIN users u ON u.id = c.user_id
  LEFT JOIN departments d ON d.id = c.department_id
  LEFT JOIN users o ON o.id = c.officer_id`;

function shape(row) {
  return {
    id: row.id,
    complaint_number: row.complaint_number,
    title: row.ai_title || row.description,
    category: row.category,
    priority_level: row.priority_level,
    status: row.status,
    citizen_name: row.citizen_name,
    department_name: row.department_name,
    officer_name: row.officer_name,
    officer_email: row.officer_email,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    feedback: row.f_id
      ? { resolved: Boolean(row.f_resolved), rating: row.f_rating, comment: row.f_comment, created_at: row.f_created_at }
      : null,
    reopen: row.reopen_created_at ? { reason: row.reopen_reason, created_at: row.reopen_created_at } : null,
  };
}

async function counts() {
  const [[res]] = await pool.query(
    `SELECT COUNT(*) AS approved, SUM(f.resolved = 1) AS confirmed, SUM(f.id IS NULL) AS awaiting
     FROM complaints c ${CURRENT_FEEDBACK_JOIN}
     WHERE c.status = 'RESOLVED'`
  );
  const [[reopen]] = await pool.query('SELECT COUNT(*) AS reopenings, COUNT(DISTINCT complaint_id) AS complaints FROM complaint_reopenings');
  return {
    approved: Number(res.approved || 0),
    confirmed: Number(res.confirmed || 0),
    awaitingFeedback: Number(res.awaiting || 0),
    notResolved: Number(reopen.reopenings || 0),
    notResolvedComplaints: Number(reopen.complaints || 0),
  };
}

/**
 * Admin overview of what happened after resolution:
 *  approved           complaints an admin marked Resolved
 *  confirmed          ... where the citizen confirmed it is really fixed
 *  awaiting-feedback  ... where the citizen has not answered yet
 *  not-resolved       every time a citizen said the fix did not work (reopened), with their reason
 */
async function overview({ view = 'approved', limit = 100 }) {
  const safeView = VIEWS.includes(view) ? view : 'approved';
  const max = Math.min(Math.max(Number(limit) || 100, 1), 200);

  let rows;
  if (safeView === 'not-resolved') {
    [rows] = await pool.query(
      `SELECT ${BASE_COLUMNS}, r.reason AS reopen_reason, r.created_at AS reopen_created_at
       FROM complaint_reopenings r
       JOIN complaints c ON c.id = r.complaint_id
       ${BASE_JOINS}
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [max]
    );
  } else {
    const where = safeView === 'confirmed' ? 'AND f.resolved = 1' : safeView === 'awaiting-feedback' ? 'AND f.id IS NULL' : '';
    [rows] = await pool.query(
      `SELECT ${BASE_COLUMNS}, f.id AS f_id, f.resolved AS f_resolved, f.rating AS f_rating, f.comment AS f_comment, f.created_at AS f_created_at
       FROM complaints c
       ${BASE_JOINS}
       ${CURRENT_FEEDBACK_JOIN}
       WHERE c.status = 'RESOLVED' ${where}
       ORDER BY c.resolved_at DESC
       LIMIT ?`,
      [max]
    );
  }
  return { view: safeView, counts: await counts(), rows: rows.map(shape) };
}

module.exports = { overview, VIEWS };
