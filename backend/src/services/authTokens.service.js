const crypto = require('crypto');
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');

const TTL_MINUTES = { PASSWORD_RESET: 60, EMAIL_VERIFY: 60 * 24 };

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Issues a one-time token (returned once, never stored in clear). Issuing a new token
 * invalidates the user's earlier unused tokens of the same purpose.
 */
async function issue(userId, purpose) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query('UPDATE auth_tokens SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [userId, purpose]);
  await pool.query(
    'INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
    [userId, purpose, hash(token), TTL_MINUTES[purpose]]
  );
  return token;
}

/** Validates and consumes a token atomically; returns the user id. Single use. */
async function consume(token, purpose) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) {
    throw new AppError('This link is invalid or has expired.', 400);
  }
  const [result] = await pool.query(
    `UPDATE auth_tokens SET used_at = NOW()
     WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW()`,
    [hash(token), purpose]
  );
  if (result.affectedRows !== 1) throw new AppError('This link is invalid or has expired.', 400);
  const [[row]] = await pool.query('SELECT user_id FROM auth_tokens WHERE token_hash = ?', [hash(token)]);
  return row.user_id;
}

module.exports = { issue, consume };
