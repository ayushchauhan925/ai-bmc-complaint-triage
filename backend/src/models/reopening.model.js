const { pool } = require('../config/db');

async function create({ complaintId, userId, reason, imageUrl }) {
  await pool.query(
    'INSERT INTO complaint_reopenings (complaint_id, user_id, reason, image_url) VALUES (?, ?, ?, ?)',
    [complaintId, userId, reason || null, imageUrl || null]
  );
}

async function listForComplaint(complaintId) {
  const [rows] = await pool.query(
    `SELECT r.*, u.name AS citizen_name FROM complaint_reopenings r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.complaint_id = ? ORDER BY r.created_at DESC`,
    [complaintId]
  );
  return rows;
}

async function countAll() {
  const [[row]] = await pool.query('SELECT COUNT(*) AS count FROM complaint_reopenings');
  return row.count;
}

module.exports = { create, listForComplaint, countAll };
