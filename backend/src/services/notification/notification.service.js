const { pool } = require('../../config/db');
const inAppChannel = require('./channels/inApp.channel');
const emailChannel = require('./channels/email.channel');
const logger = require('../../utils/logger');
const metrics = require('../observability/metrics.service');

/**
 * Notification abstraction. Business logic calls `notify()` with *what happened* and *who
 * should know*; which channels deliver it is decided here. A channel is any object with
 * { name, isEnabled(), send(payload) } - adding SMS or push later means adding one file in
 * ./channels and one entry below, with no change to callers.
 *
 * Delivery never throws into the caller: a failed notification must not be able to roll back
 * or fail the operation that triggered it (status change, escalation, ...).
 */
const CHANNELS = [inAppChannel, emailChannel];

async function notify(payload) {
  const outcomes = {};
  for (const channel of CHANNELS) {
    if (!channel.isEnabled()) continue;
    try {
      outcomes[channel.name] = await channel.send(payload);
    } catch (err) {
      outcomes[channel.name] = { delivered: false, error: err.message };
      metrics.recordError('external', `notification via ${channel.name} failed: ${err.message}`);
      logger.warn('Notification delivery failed.', { channel: channel.name, type: payload.type, error: err.message });
    }
  }
  return outcomes;
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

function enabledChannels() {
  return CHANNELS.filter((c) => c.isEnabled()).map((c) => c.name);
}

module.exports = { notify, listForUser, markRead, enabledChannels };
