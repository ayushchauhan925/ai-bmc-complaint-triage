const { pool } = require('../../config/db');
const logger = require('../../utils/logger');
const { DEPARTMENT_CATALOG } = require('../../utils/departmentCatalog');

/**
 * Makes sure every catalog department has a row in the `departments` table. Idempotent and
 * non-destructive: a missing code is inserted; an existing row is left exactly as it is, so an
 * admin's edits (name, description, contacts, active flag) survive restarts and re-seeding.
 *
 * Called at server start and by the seed script - production must not depend on someone
 * remembering to run `npm run seed` for routing to have somewhere to send complaints.
 */
async function ensureDepartmentCatalog() {
  let created = 0;
  for (const dept of DEPARTMENT_CATALOG) {
    const [result] = await pool.query(
      'INSERT IGNORE INTO departments (code, name, description) VALUES (?, ?, ?)',
      [dept.code, dept.name, dept.description]
    );
    created += result.affectedRows;
  }
  if (created > 0) logger.info('Department catalog synced.', { created, total: DEPARTMENT_CATALOG.length });
  return { created, total: DEPARTMENT_CATALOG.length };
}

module.exports = { ensureDepartmentCatalog };
