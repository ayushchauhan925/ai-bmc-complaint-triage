const { pool } = require('../config/db');

async function log({ userId, queryText, filters, resultCount }) {
  await pool.query(
    'INSERT INTO ai_admin_queries (user_id, query_text, filters_json, result_count) VALUES (?, ?, ?, ?)',
    [userId, queryText, JSON.stringify(filters), resultCount]
  );
}

async function recent(limit = 20) {
  const [rows] = await pool.query(
    `SELECT q.*, u.name AS user_name FROM ai_admin_queries q
     LEFT JOIN users u ON u.id = q.user_id
     ORDER BY q.created_at DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

module.exports = { log, recent };
