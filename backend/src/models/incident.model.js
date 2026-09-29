const { pool } = require('../config/db');
const incidentEventModel = require('./incidentEvent.model');

async function generateIncidentNumber(conn) {
  const year = new Date().getFullYear();
  const [rows] = await conn.query('SELECT COUNT(*) AS cnt FROM incidents WHERE incident_number LIKE ?', [
    `INC-${year}-%`,
  ]);
  const seq = String(rows[0].cnt + 1).padStart(4, '0');
  return `INC-${year}-${seq}`;
}

async function create(conn, { title, category, latitude, longitude, departmentId, priorityScore, priorityLevel }) {
  const incidentNumber = await generateIncidentNumber(conn);
  const [result] = await conn.query(
    `INSERT INTO incidents (incident_number, title, category, latitude, longitude, department_id, priority_score, priority_level, status, complaint_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 0)`,
    [incidentNumber, title, category, latitude, longitude, departmentId, priorityScore, priorityLevel]
  );
  await incidentEventModel.log(
    { incidentId: result.insertId, eventType: 'CREATED', notes: `Incident ${incidentNumber} created: ${title}` },
    conn
  );
  return { id: result.insertId, incidentNumber };
}

async function linkComplaint(conn, incidentId, complaintId, actorUserId = null) {
  const [existing] = await conn.query(
    'SELECT 1 FROM incident_complaints WHERE incident_id = ? AND complaint_id = ?',
    [incidentId, complaintId]
  );
  if (existing.length > 0) return;

  await conn.query('INSERT INTO incident_complaints (incident_id, complaint_id) VALUES (?, ?)', [
    incidentId,
    complaintId,
  ]);
  await conn.query('UPDATE complaints SET incident_id = ? WHERE id = ?', [incidentId, complaintId]);
  await refreshComplaintCount(conn, incidentId);
  await incidentEventModel.log(
    { incidentId, eventType: 'COMPLAINT_LINKED', notes: `Complaint #${complaintId} linked.`, createdBy: actorUserId },
    conn
  );
}

async function unlinkComplaint(conn, incidentId, complaintId, actorUserId = null) {
  await conn.query('DELETE FROM incident_complaints WHERE incident_id = ? AND complaint_id = ?', [
    incidentId,
    complaintId,
  ]);
  await conn.query('UPDATE complaints SET incident_id = NULL WHERE id = ? AND incident_id = ?', [
    complaintId,
    incidentId,
  ]);
  await refreshComplaintCount(conn, incidentId);
  await incidentEventModel.log(
    { incidentId, eventType: 'COMPLAINT_UNLINKED', notes: `Complaint #${complaintId} removed.`, createdBy: actorUserId },
    conn
  );
}

async function refreshComplaintCount(conn, incidentId) {
  const [rows] = await conn.query('SELECT COUNT(*) AS cnt FROM incident_complaints WHERE incident_id = ?', [
    incidentId,
  ]);
  await conn.query('UPDATE incidents SET complaint_count = ? WHERE id = ?', [rows[0].cnt, incidentId]);
}

async function updatePriority(incidentId, priorityScore, priorityLevel) {
  await pool.query('UPDATE incidents SET priority_score = ?, priority_level = ? WHERE id = ?', [
    priorityScore,
    priorityLevel,
    incidentId,
  ]);
}

async function updateStatus(incidentId, status, actorUserId = null) {
  await pool.query('UPDATE incidents SET status = ? WHERE id = ?', [status, incidentId]);
  await incidentEventModel.log({
    incidentId,
    eventType: 'STATUS_CHANGED',
    notes: `Status changed to ${status}.`,
    createdBy: actorUserId,
  });
}

// Merge `sourceIncidentId` into `targetIncidentId`: moves every linked complaint across,
// closes the source incident, and logs the merge on both timelines (Section 5).
async function mergeInto(targetIncidentId, sourceIncidentId, actorUserId = null) {
  if (Number(targetIncidentId) === Number(sourceIncidentId)) {
    throw new Error('Cannot merge an incident into itself.');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [complaintRows] = await conn.query(
      'SELECT complaint_id FROM incident_complaints WHERE incident_id = ?',
      [sourceIncidentId]
    );
    for (const row of complaintRows) {
      await linkComplaint(conn, targetIncidentId, row.complaint_id, actorUserId);
      await unlinkComplaint(conn, sourceIncidentId, row.complaint_id, actorUserId);
    }

    await conn.query("UPDATE incidents SET status = 'CLOSED' WHERE id = ?", [sourceIncidentId]);
    await incidentEventModel.log(
      { incidentId: sourceIncidentId, eventType: 'MERGED', notes: `Merged into incident #${targetIncidentId}.`, createdBy: actorUserId },
      conn
    );
    await incidentEventModel.log(
      { incidentId: targetIncidentId, eventType: 'MERGE_RECEIVED', notes: `Absorbed incident #${sourceIncidentId}.`, createdBy: actorUserId },
      conn
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT i.*, d.name AS department_name FROM incidents i LEFT JOIN departments d ON d.id = i.department_id WHERE i.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function getLinkedComplaints(incidentId) {
  const [rows] = await pool.query(
    `SELECT c.* FROM complaints c
     INNER JOIN incident_complaints ic ON ic.complaint_id = c.id
     WHERE ic.incident_id = ?
     ORDER BY c.created_at DESC`,
    [incidentId]
  );
  return rows;
}

async function findIncidentIdForAnyComplaint(complaintIds) {
  if (complaintIds.length === 0) return null;
  const [rows] = await pool.query(
    `SELECT incident_id FROM complaints WHERE id IN (${complaintIds.map(() => '?').join(',')}) AND incident_id IS NOT NULL LIMIT 1`,
    complaintIds
  );
  return rows[0]?.incident_id || null;
}

async function list(filters = {}, { page = 1, limit = 20 } = {}) {
  const clauses = [];
  const params = [];
  if (filters.status) {
    clauses.push('i.status = ?');
    params.push(filters.status);
  }
  if (filters.department_id) {
    clauses.push('i.department_id = ?');
    params.push(filters.department_id);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT i.*, d.name AS department_name FROM incidents i
     LEFT JOIN departments d ON d.id = i.department_id
     ${where}
     ORDER BY i.priority_score DESC, i.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM incidents i ${where}`, params);
  return { rows, total: countRows[0].total, page, limit };
}

module.exports = {
  create,
  linkComplaint,
  unlinkComplaint,
  updatePriority,
  updateStatus,
  mergeInto,
  findById,
  getLinkedComplaints,
  findIncidentIdForAnyComplaint,
  list,
};
