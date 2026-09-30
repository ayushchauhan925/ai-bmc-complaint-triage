const { pool } = require('../config/db');

async function generateComplaintNumber(conn) {
  const year = new Date().getFullYear();
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS cnt FROM complaints WHERE complaint_number LIKE ?',
    [`CMP-${year}-%`]
  );
  const seq = String(rows[0].cnt + 1).padStart(5, '0');
  return `CMP-${year}-${seq}`;
}

async function create(conn, data) {
  const complaintNumber = await generateComplaintNumber(conn);
  const [result] = await conn.query(
    `INSERT INTO complaints (
       complaint_number, user_id, description, category, subcategory, language,
       latitude, longitude, address, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      complaintNumber,
      data.userId,
      data.description,
      data.category || 'OTHER',
      data.subcategory || null,
      data.language || null,
      data.latitude,
      data.longitude,
      data.address || null,
      'SUBMITTED',
    ]
  );
  return { id: result.insertId, complaintNumber };
}

async function addImage(conn, complaintId, imageUrl, imageType = 'ORIGINAL', metrics = null) {
  await conn.query(
    `INSERT INTO complaint_images (complaint_id, image_url, image_type, phash, blur_score, brightness, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      complaintId,
      imageUrl,
      imageType,
      metrics?.phash ?? null,
      metrics?.blurScore ?? null,
      metrics?.brightness ?? null,
      metrics?.width ?? null,
      metrics?.height ?? null,
    ]
  );
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM complaints WHERE id = ?', [id]);
  return rows[0] || null;
}

async function getImages(complaintId) {
  const [rows] = await pool.query(
    'SELECT * FROM complaint_images WHERE complaint_id = ? ORDER BY uploaded_at',
    [complaintId]
  );
  return rows;
}

async function getHistory(complaintId) {
  const [rows] = await pool.query(
    `SELECT h.*, u.name AS actor_name, u.role AS actor_role
     FROM complaint_status_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.complaint_id = ?
     ORDER BY h.created_at ASC`,
    [complaintId]
  );
  return rows;
}

async function addHistory(conn, complaintId, oldStatus, newStatus, changedBy, notes) {
  await conn.query(
    `INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [complaintId, oldStatus, newStatus, changedBy || null, notes || null]
  );
}

async function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  await pool.query(`UPDATE complaints SET ${setClause} WHERE id = ?`, [...values, id]);
}

function buildFilterClause(filters) {
  const clauses = [];
  const params = [];

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      clauses.push(`c.status IN (${filters.status.map(() => '?').join(',')})`);
      params.push(...filters.status);
    } else {
      clauses.push('c.status = ?');
      params.push(filters.status);
    }
  }
  if (filters.category) {
    clauses.push('c.category = ?');
    params.push(filters.category);
  }
  if (filters.priority_level) {
    if (Array.isArray(filters.priority_level)) {
      clauses.push(`c.priority_level IN (${filters.priority_level.map(() => '?').join(',')})`);
      params.push(...filters.priority_level);
    } else {
      clauses.push('c.priority_level = ?');
      params.push(filters.priority_level);
    }
  }
  if (filters.department_id) {
    clauses.push('c.department_id = ?');
    params.push(filters.department_id);
  }
  if (filters.ward_id) {
    clauses.push('c.ward_id = ?');
    params.push(filters.ward_id);
  }
  if (filters.officer_id) {
    clauses.push('c.officer_id = ?');
    params.push(filters.officer_id);
  }
  if (filters.user_id) {
    clauses.push('c.user_id = ?');
    params.push(filters.user_id);
  }
  if (filters.incident_id) {
    clauses.push('c.incident_id = ?');
    params.push(filters.incident_id);
  }
  if (filters.review_required !== undefined) {
    clauses.push('c.review_required = ?');
    params.push(filters.review_required ? 1 : 0);
  }
  if (filters.search) {
    clauses.push('(c.description LIKE ? OR c.complaint_number LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.sla_status) {
    if (Array.isArray(filters.sla_status)) {
      clauses.push(`c.sla_status IN (${filters.sla_status.map(() => '?').join(',')})`);
      params.push(...filters.sla_status);
    } else {
      clauses.push('c.sla_status = ?');
      params.push(filters.sla_status);
    }
  }
  // near_school/near_hospital read the AI-extracted severity_signals JSON (Section 9's "near
  // a school" example) - there is no separate schools/POI dataset in this build.
  if (filters.near_school) {
    clauses.push(`JSON_EXTRACT(c.severity_signals, '$.near_school') = true`);
  }
  if (filters.near_hospital) {
    clauses.push(`JSON_EXTRACT(c.severity_signals, '$.near_hospital') = true`);
  }
  if (filters.date_from) {
    clauses.push('c.created_at >= ?');
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    clauses.push('c.created_at <= ?');
    params.push(filters.date_to);
  }
  if (filters.min_related_count) {
    clauses.push(
      `c.incident_id IN (SELECT id FROM incidents WHERE complaint_count >= ?)`
    );
    params.push(filters.min_related_count);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function list(filters = {}, { page = 1, limit = 20 } = {}) {
  const { where, params } = buildFilterClause(filters);
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT c.*, d.name AS department_name, w.ward_name, u.name AS citizen_name
     FROM complaints c
     LEFT JOIN departments d ON d.id = c.department_id
     LEFT JOIN wards w ON w.id = c.ward_id
     LEFT JOIN users u ON u.id = c.user_id
     ${where}
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM complaints c ${where}`,
    params
  );

  return { rows, total: countRows[0].total, page, limit };
}

async function findNearby({ latitude, longitude, radiusMeters, sinceDate, excludeId }) {
  // Bounding-box prefilter (cheap, index-friendly) then exact Haversine filter in JS via proximity.service.
  const latDelta = radiusMeters / 111000;
  const lonDelta = radiusMeters / (111000 * Math.cos((latitude * Math.PI) / 180) || 1);

  const params = [
    latitude - latDelta,
    latitude + latDelta,
    longitude - lonDelta,
    longitude + lonDelta,
    sinceDate,
  ];
  let query = `
    SELECT * FROM complaints
    WHERE latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
      AND created_at >= ?
  `;
  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  query += ' ORDER BY created_at DESC LIMIT 200';

  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Historical pattern: how many earlier complaints of the same category were filed close to
 * this spot within the look-back window (regardless of status). Bounding box in SQL, exact
 * distance in the caller's radius via the box size - good enough for a 150 m pattern check.
 */
async function countHistoricalNearby({ latitude, longitude, category, radiusMeters, days, excludeId }) {
  const latDelta = radiusMeters / 111000;
  const lonDelta = radiusMeters / (111000 * Math.cos((latitude * Math.PI) / 180) || 1);
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM complaints
     WHERE category = ? AND id != ?
       AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [category, excludeId || 0, latitude - latDelta, latitude + latDelta, longitude - lonDelta, longitude + lonDelta, days]
  );
  return Number(row.cnt);
}

module.exports = {
  countHistoricalNearby,
  create,
  addImage,
  findById,
  getImages,
  getHistory,
  addHistory,
  update,
  list,
  findNearby,
};
