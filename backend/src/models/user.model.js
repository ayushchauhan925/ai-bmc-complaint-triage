const { pool } = require('../config/db');

const PUBLIC_FIELDS = 'id, name, email, phone, role, department_id, email_verified_at, created_at';

async function findByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function create({ name, email, passwordHash, phone, role, departmentId }) {
  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, phone, role, department_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, passwordHash, phone || null, role, departmentId || null]
  );
  return findById(result.insertId);
}

async function listByRole(role) {
  const [rows] = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE role = ? ORDER BY name`, [role]);
  return rows;
}

async function recordFailedLogin(id, attempts, lockUntil) {
  await pool.query('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?', [attempts, lockUntil, id]);
}

async function clearLoginFailures(id) {
  await pool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [id]);
}

async function setPassword(id, passwordHash) {
  await pool.query('UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [passwordHash, id]);
}

async function markEmailVerified(id) {
  await pool.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?', [id]);
}

module.exports = { findByEmail, findById, create, listByRole, recordFailedLogin, clearLoginFailures, setPassword, markEmailVerified };
