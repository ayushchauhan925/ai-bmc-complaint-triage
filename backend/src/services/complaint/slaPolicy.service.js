const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { SLA_HOURS_BY_PRIORITY, SLA_APPROACHING_THRESHOLD_PCT, CATEGORIES } = require('../../utils/constants');

const LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CACHE_TTL_MS = 60 * 1000;

let cache = { loadedAt: 0, rows: [] };

function invalidate() {
  cache = { loadedAt: 0, rows: [] };
}

async function loadPolicies() {
  if (Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.rows;
  try {
    const [rows] = await pool.query('SELECT * FROM sla_policies WHERE is_active = TRUE');
    cache = { loadedAt: Date.now(), rows };
  } catch (err) {
    // Table missing / DB hiccup: fall back to constants rather than failing the pipeline.
    logger.warn('Could not load SLA policies; using built-in defaults.', { error: err.message });
    cache = { loadedAt: Date.now() - CACHE_TTL_MS + 5000, rows: [] };
  }
  return cache.rows;
}

/**
 * Resolves the SLA for a priority level + category: a category-specific policy overrides
 * the priority default; the built-in constants are the last resort. Returned as a snapshot
 * (hours + warning ratio) so it can be stored on the complaint and stay auditable even if
 * the policy is edited later.
 */
async function resolvePolicy(priorityLevel, category) {
  const rows = await loadPolicies();
  const specific = rows.find((r) => r.priority_level === priorityLevel && r.category_key === category);
  const generic = rows.find((r) => r.priority_level === priorityLevel && r.category_key === '*');
  const row = specific || generic;
  if (row) {
    return { hours: Number(row.target_hours), warningPct: Number(row.warning_pct), source: specific ? 'category' : 'priority' };
  }
  return {
    hours: SLA_HOURS_BY_PRIORITY[priorityLevel] ?? SLA_HOURS_BY_PRIORITY.LOW,
    warningPct: SLA_APPROACHING_THRESHOLD_PCT,
    source: 'default',
  };
}

async function listPolicies() {
  const [rows] = await pool.query('SELECT * FROM sla_policies ORDER BY FIELD(priority_level, "CRITICAL","HIGH","MEDIUM","LOW"), category_key');
  return rows;
}

async function upsertPolicy({ priorityLevel, categoryKey = '*', targetHours, warningPct = 0.8, isActive = true }) {
  if (!LEVELS.includes(priorityLevel)) throw new AppError('Invalid priority level.', 400);
  if (categoryKey !== '*' && !CATEGORIES.includes(categoryKey)) throw new AppError('Invalid category.', 400);
  if (!Number.isInteger(targetHours) || targetHours < 1 || targetHours > 24 * 90) {
    throw new AppError('targetHours must be a whole number between 1 and 2160.', 400);
  }
  if (!(warningPct > 0 && warningPct < 1)) throw new AppError('warningPct must be between 0 and 1.', 400);

  await pool.query(
    `INSERT INTO sla_policies (priority_level, category_key, target_hours, warning_pct, is_active)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE target_hours = VALUES(target_hours), warning_pct = VALUES(warning_pct), is_active = VALUES(is_active)`,
    [priorityLevel, categoryKey, targetHours, warningPct, isActive ? 1 : 0]
  );
  invalidate();
  const [rows] = await pool.query('SELECT * FROM sla_policies WHERE priority_level = ? AND category_key = ?', [priorityLevel, categoryKey]);
  return rows[0];
}

module.exports = { resolvePolicy, listPolicies, upsertPolicy, invalidate, LEVELS };
