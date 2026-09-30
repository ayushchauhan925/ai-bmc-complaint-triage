const { pool } = require('../../../config/db');

// In-app notifications are the system of record: always enabled, stored in MySQL and read
// by the frontend bell. Other channels (email, future SMS/push) are best-effort mirrors.
module.exports = {
  name: 'in_app',
  isEnabled: () => true,
  async send({ userId, title, message, type, relatedComplaintId = null }) {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, related_complaint_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type, relatedComplaintId]
    );
    return { delivered: true };
  },
};
