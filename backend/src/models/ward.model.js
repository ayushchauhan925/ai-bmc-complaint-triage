const { pool } = require('../config/db');

async function findAll() {
  const [rows] = await pool.query('SELECT * FROM wards ORDER BY ward_name');
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM wards WHERE id = ?', [id]);
  return rows[0] || null;
}

module.exports = { findAll, findById };
