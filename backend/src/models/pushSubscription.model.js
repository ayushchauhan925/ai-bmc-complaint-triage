const crypto = require('crypto');
const { pool } = require('../config/db');

const hash = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex');

async function upsert(userId, { endpoint, p256dh, auth }) {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, endpoint_hash, p256dh, auth)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [userId, endpoint, hash(endpoint), p256dh, auth]
  );
}

async function remove(userId, endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint_hash = ? AND user_id = ?', [hash(endpoint), userId]);
}

async function removeByEndpoint(endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint_hash = ?', [hash(endpoint)]);
}

async function listForUser(userId) {
  const [rows] = await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId]);
  return rows;
}

async function countForUser(userId) {
  const [[row]] = await pool.query('SELECT COUNT(*) AS cnt FROM push_subscriptions WHERE user_id = ?', [userId]);
  return Number(row.cnt);
}

module.exports = { upsert, remove, removeByEndpoint, listForUser, countForUser };
