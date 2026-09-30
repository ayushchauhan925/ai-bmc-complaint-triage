const { pool } = require('../../config/db');
const logger = require('../../utils/logger');
const metrics = require('../observability/metrics.service');

const SENSITIVE_KEY = /pass(word)?|secret|token|api[_-]?key|authorization|credential|hash/i;
const MAX_STRING = 500;

// Strips anything that looks like a credential and truncates long strings, so an audit row
// can never become a place secrets or bulk personal data leak into.
function sanitize(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (depth > 4) return '[truncated]';
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : sanitize(v, depth + 1);
  }
  return out;
}

/**
 * Records an audit entry. Never throws: auditing must not be able to break the operation
 * being audited (a failure is logged and counted instead).
 */
async function record({ actor = null, action, entityType, entityId = null, previous = null, next = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        actor?.id ?? null,
        actor?.role ?? (actor ? null : 'SYSTEM'),
        action,
        entityType,
        entityId === null || entityId === undefined ? null : String(entityId),
        previous === null ? null : JSON.stringify(sanitize(previous)),
        next === null ? null : JSON.stringify(sanitize(next)),
      ]
    );
  } catch (err) {
    metrics.recordError('database', `audit insert failed: ${err.message}`);
    logger.error('Failed to write audit log.', { action, entityType, error: err.message });
  }
}

async function list({ entityType, entityId, action, actorId, dateFrom, dateTo, page = 1, limit = 50 } = {}) {
  const clauses = [];
  const params = [];
  if (entityType) { clauses.push('a.entity_type = ?'); params.push(entityType); }
  if (entityId) { clauses.push('a.entity_id = ?'); params.push(String(entityId)); }
  if (action) { clauses.push('a.action = ?'); params.push(action); }
  if (actorId) { clauses.push('a.actor_id = ?'); params.push(Number(actorId)); }
  if (dateFrom) { clauses.push('a.created_at >= ?'); params.push(dateFrom); }
  if (dateTo) { clauses.push('a.created_at <= ?'); params.push(dateTo); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * safeLimit;

  const [rows] = await pool.query(
    `SELECT a.*, u.name AS actor_name FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs a ${where}`, params);
  return { rows, total, page: Number(page) || 1, limit: safeLimit };
}

module.exports = { record, list, sanitize };
