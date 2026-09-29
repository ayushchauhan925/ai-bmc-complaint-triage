const { pool } = require('../config/db');

async function upsert(complaintId, embedding, model) {
  const embeddingJson = JSON.stringify(embedding);
  await pool.query(
    `INSERT INTO complaint_embeddings (complaint_id, embedding, model)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE embedding = VALUES(embedding), model = VALUES(model)`,
    [complaintId, embeddingJson, model]
  );
}

async function findByComplaintId(complaintId) {
  const [rows] = await pool.query('SELECT * FROM complaint_embeddings WHERE complaint_id = ?', [complaintId]);
  if (!rows[0]) return null;
  return { ...rows[0], embedding: JSON.parse(rows[0].embedding) };
}

async function findByComplaintIds(complaintIds) {
  if (complaintIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT * FROM complaint_embeddings WHERE complaint_id IN (${complaintIds.map(() => '?').join(',')})`,
    complaintIds
  );
  return rows.map((r) => ({ ...r, embedding: JSON.parse(r.embedding) }));
}

module.exports = { upsert, findByComplaintId, findByComplaintIds };
