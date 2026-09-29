const { pool } = require('../config/db');

async function log({ incidentId, eventType, notes, createdBy }, conn = pool) {
  await conn.query(
    'INSERT INTO incident_events (incident_id, event_type, notes, created_by) VALUES (?, ?, ?, ?)',
    [incidentId, eventType, notes || null, createdBy || null]
  );
}

async function listForIncident(incidentId) {
  const [rows] = await pool.query(
    `SELECT e.*, u.name AS actor_name FROM incident_events e
     LEFT JOIN users u ON u.id = e.created_by
     WHERE e.incident_id = ? ORDER BY e.created_at ASC`,
    [incidentId]
  );
  return rows;
}

module.exports = { log, listForIncident };
