const { pool } = require('../../config/db');

const VIEWS = ['awaiting-approval', 'sent-back', 'approved', 'confirmed', 'awaiting-feedback', 'not-resolved'];

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

/**
 * Restricts the overview to one officer's complaints or one department's. No scope = everything (admin).
 * Returns a SQL fragment (always starts with AND) and its parameters.
 */
function scopeClause(scope) {
  if (scope && scope.officerId) return { sql: 'AND c.officer_id = ?', params: [scope.officerId] };
  if (scope && scope.departmentId) return { sql: 'AND c.department_id = ?', params: [scope.departmentId] };
  return { sql: '', params: [] };
}

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
    // Latest relevant status change: when the fix was submitted (awaiting-approval) or sent back (sent-back), with its note.
    event: row.event_at ? { at: row.event_at, note: row.event_note } : null,
  };
}

async function counts(scope) {
  const sc = scopeClause(scope);
  const [[res]] = await pool.query(
    `SELECT COUNT(*) AS approved, SUM(f.resolved = 1) AS confirmed, SUM(f.id IS NULL) AS awaiting
     FROM complaints c ${CURRENT_FEEDBACK_JOIN}
     WHERE c.status = 'RESOLVED' ${sc.sql}`,
    sc.params
  );
  const [[reopen]] = await pool.query(
    `SELECT COUNT(*) AS reopenings, COUNT(DISTINCT r.complaint_id) AS complaints
     FROM complaint_reopenings r JOIN complaints c ON c.id = r.complaint_id
     WHERE 1 = 1 ${sc.sql}`,
    sc.params
  );
  const [[waiting]] = await pool.query(
    `SELECT COUNT(*) AS n FROM complaints c WHERE c.status = 'RESOLUTION_SUBMITTED' ${sc.sql}`,
    sc.params
  );
  const [[sentBack]] = await pool.query(
    `SELECT COUNT(*) AS n FROM complaints c
     WHERE c.status = 'IN_PROGRESS' ${sc.sql}
       AND EXISTS (SELECT 1 FROM complaint_status_history h WHERE h.complaint_id = c.id AND h.old_status = 'RESOLUTION_SUBMITTED' AND h.new_status = 'IN_PROGRESS')`,
    sc.params
  );
  return {
    awaitingApproval: Number(waiting.n || 0),
    sentBack: Number(sentBack.n || 0),
    approved: Number(res.approved || 0),
    confirmed: Number(res.confirmed || 0),
    awaitingFeedback: Number(res.awaiting || 0),
    notResolved: Number(reopen.reopenings || 0),
    notResolvedComplaints: Number(reopen.complaints || 0),
  };
}

/**
 * What happened around resolutions:
 *  awaiting-approval  officer submitted a fix; waiting for an admin decision
 *  sent-back          an admin sent the fix back to the officer (with their note)
 *  approved           an admin marked the complaint Resolved
 *  confirmed          ... and the citizen confirmed it is really fixed
 *  awaiting-feedback  ... and the citizen has not answered yet
 *  not-resolved       every time a citizen said the fix did not work (reopened), with their reason
 */
async function overview({ view = 'approved', limit = 100, scope = null }) {
  const safeView = VIEWS.includes(view) ? view : 'approved';
  const max = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const sc = scopeClause(scope);

  let rows;
  if (safeView === 'not-resolved') {
    [rows] = await pool.query(
      `SELECT ${BASE_COLUMNS}, r.reason AS reopen_reason, r.created_at AS reopen_created_at
       FROM complaint_reopenings r
       JOIN complaints c ON c.id = r.complaint_id
       ${BASE_JOINS}
       WHERE 1 = 1 ${sc.sql}
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [...sc.params, max]
    );
  } else if (safeView === 'awaiting-approval' || safeView === 'sent-back') {
    const sentBack = safeView === 'sent-back';
    const eventJoin = sentBack
      ? `LEFT JOIN complaint_status_history h ON h.id = (SELECT MAX(h2.id) FROM complaint_status_history h2 WHERE h2.complaint_id = c.id AND h2.old_status = 'RESOLUTION_SUBMITTED' AND h2.new_status = 'IN_PROGRESS')`
      : `LEFT JOIN complaint_status_history h ON h.id = (SELECT MAX(h2.id) FROM complaint_status_history h2 WHERE h2.complaint_id = c.id AND h2.new_status = 'RESOLUTION_SUBMITTED')`;
    const statusWhere = sentBack ? `c.status = 'IN_PROGRESS' AND h.id IS NOT NULL` : `c.status = 'RESOLUTION_SUBMITTED'`;
    [rows] = await pool.query(
      `SELECT ${BASE_COLUMNS}, h.created_at AS event_at, h.notes AS event_note
       FROM complaints c
       ${BASE_JOINS}
       ${eventJoin}
       WHERE ${statusWhere} ${sc.sql}
       ORDER BY h.created_at DESC
       LIMIT ?`,
      [...sc.params, max]
    );
  } else {
    const where = safeView === 'confirmed' ? 'AND f.resolved = 1' : safeView === 'awaiting-feedback' ? 'AND f.id IS NULL' : '';
    [rows] = await pool.query(
      `SELECT ${BASE_COLUMNS}, f.id AS f_id, f.resolved AS f_resolved, f.rating AS f_rating, f.comment AS f_comment, f.created_at AS f_created_at
       FROM complaints c
       ${BASE_JOINS}
       ${CURRENT_FEEDBACK_JOIN}
       WHERE c.status = 'RESOLVED' ${where} ${sc.sql}
       ORDER BY c.resolved_at DESC
       LIMIT ?`,
      [...sc.params, max]
    );
  }
  return { view: safeView, counts: await counts(scope), rows: rows.map(shape) };
}

module.exports = { overview, VIEWS };
