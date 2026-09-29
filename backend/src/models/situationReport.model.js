const { pool } = require('../config/db');

async function create({ generatedBy, summary, statsSnapshot }) {
  const [result] = await pool.query(
    'INSERT INTO ai_situation_reports (generated_by, summary, stats_snapshot) VALUES (?, ?, ?)',
    [generatedBy || null, summary, JSON.stringify(statsSnapshot)]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT r.*, u.name AS generated_by_name FROM ai_situation_reports r
     LEFT JOIN users u ON u.id = r.generated_by WHERE r.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function list(limit = 20) {
  const [rows] = await pool.query(
    `SELECT r.*, u.name AS generated_by_name FROM ai_situation_reports r
     LEFT JOIN users u ON u.id = r.generated_by
     ORDER BY r.created_at DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

async function findLatest(withinHours = 24) {
  const [rows] = await pool.query(
    `SELECT * FROM ai_situation_reports
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY created_at DESC LIMIT 1`,
    [withinHours]
  );
  return rows[0] || null;
}

module.exports = { create, findById, list, findLatest };
