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

module.exports = { findAll, findByCode, findById };
