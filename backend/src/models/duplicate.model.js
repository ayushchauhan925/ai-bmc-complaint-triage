const { pool } = require('../config/db');

async function upsertSuggestions(complaintId, results) {
  for (const r of results) {
    await pool.query(
      `INSERT INTO complaint_duplicates
         (complaint_id, related_complaint_id, duplicate_probability, semantic_score, text_score, distance_meters, image_similarity, indicators)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         duplicate_probability = VALUES(duplicate_probability),
         semantic_score = VALUES(semantic_score),
         text_score = VALUES(text_score),
         distance_meters = VALUES(distance_meters),
         image_similarity = VALUES(image_similarity),
         indicators = VALUES(indicators)`,
      [
        complaintId,
        r.complaint.id,
        r.duplicateProbability,
        r.method === 'semantic' ? Number(r.semanticScore.toFixed(3)) : null,
        r.textScore,
        Math.round(r.distanceMeters),
        r.imageSimilarity,
        JSON.stringify(r.indicators),
      ]
    );
  }
}

async function listForComplaint(complaintId) {
  const [rows] = await pool.query(
    `SELECT d.*, c.complaint_number, c.category, c.status, c.incident_id, c.created_at AS related_created_at,
            c.priority_level, LEFT(c.description, 200) AS description_excerpt
     FROM complaint_duplicates d
     JOIN complaints c ON c.id = d.related_complaint_id
     WHERE d.complaint_id = ?
     ORDER BY d.duplicate_probability DESC`,
    [complaintId]
  );
  return rows;
}

async function findPair(complaintId, relatedId) {
  const [rows] = await pool.query(
    'SELECT * FROM complaint_duplicates WHERE complaint_id = ? AND related_complaint_id = ?',
    [complaintId, relatedId]
  );
  return rows[0] || null;
}

async function setReview(complaintId, relatedId, status, reviewerId) {
  const [result] = await pool.query(
    `UPDATE complaint_duplicates SET review_status = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE complaint_id = ? AND related_complaint_id = ?`,
    [status, reviewerId, complaintId, relatedId]
  );
  return result.affectedRows > 0;
}

/** Duplicate-suggestion precision over staff-reviewed suggestions (evaluation data). */
async function precisionStats() {
  const [[row]] = await pool.query(
    `SELECT SUM(review_status = 'CONFIRMED') AS confirmed, SUM(review_status = 'REJECTED') AS rejected,
            SUM(review_status = 'SUGGESTED') AS pending
     FROM complaint_duplicates`
  );
  return {
    confirmed: Number(row.confirmed || 0),
    rejected: Number(row.rejected || 0),
    pending: Number(row.pending || 0),
  };
}

module.exports = { upsertSuggestions, listForComplaint, findPair, setReview, precisionStats };
