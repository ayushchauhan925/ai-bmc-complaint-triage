const { pool } = require('../../config/db');

async function notify({ userId, title, message, type, relatedComplaintId = null }) {
  await pool.query(
    `INSERT INTO notifications (user_id, title, message, type, related_complaint_id)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, title, message, type, relatedComplaintId]
  );
}

async function listForUser(userId, { unreadOnly = false } = {}) {
  const query = unreadOnly
    ? 'SELECT * FROM notifications WHERE user_id = ? AND is_read = FALSE ORDER BY created_at DESC LIMIT 100'
    : 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100';
  const [rows] = await pool.query(query, [userId]);
  return rows;
}

async function markRead(id, userId) {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [id, userId]);
}

module.exports = { notify, listForUser, markRead };
