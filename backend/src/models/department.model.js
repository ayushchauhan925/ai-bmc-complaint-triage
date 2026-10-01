const { pool } = require('../config/db');

async function findAll() {
  const [rows] = await pool.query('SELECT * FROM departments ORDER BY name');
  return rows;
}

async function findByCode(code) {
  const [rows] = await pool.query('SELECT * FROM departments WHERE code = ?', [code]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM departments WHERE id = ?', [id]);
  return rows[0] || null;
}

/** Departments with live officer / workload counts, for the admin Departments page. */
async function listWithCounts({ search, active } = {}) {
  const clauses = [];
  const params = [];
  if (search) {
    clauses.push('(d.name LIKE ? OR d.code LIKE ? OR d.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (active === true) clauses.push('d.is_active = TRUE');
  if (active === false) clauses.push('d.is_active = FALSE');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT d.*,
       (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'OFFICER' AND u.is_active = TRUE) AS active_officers,
       (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'OFFICER') AS total_officers,
       (SELECT COUNT(*) FROM complaints c WHERE c.department_id = d.id AND c.status NOT IN ('RESOLVED', 'REJECTED')) AS active_complaints,
       (SELECT COUNT(*) FROM complaints c WHERE c.department_id = d.id AND c.status NOT IN ('RESOLVED', 'REJECTED') AND c.priority_level = 'CRITICAL') AS critical_complaints
     FROM departments d ${where} ORDER BY d.is_active DESC, d.name`,
    params
  );
  return rows;
}

async function countOpenComplaints(departmentId) {
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM complaints WHERE department_id = ? AND status NOT IN ('RESOLVED', 'REJECTED')",
    [departmentId]
  );
  return Number(row.cnt);
}

async function update(id, fields) {
  const allowed = ['description', 'contact_email', 'contact_phone', 'is_active'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return;
  await pool.query(`UPDATE departments SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => fields[k]), id]);
}

module.exports = { findAll, findByCode, findById, listWithCounts, countOpenComplaints, update };
