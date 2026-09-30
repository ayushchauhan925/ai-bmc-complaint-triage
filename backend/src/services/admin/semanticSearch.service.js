const embeddingService = require('../ai/embedding.service');
const embeddingModel = require('../../models/embedding.model');
const complaintModel = require('../../models/complaint.model');
const { pool } = require('../../config/db');
const { cosineSimilarity } = require('../../utils/vectorMath');

const MIN_SIMILARITY = 0.35;

/**
 * Meaning-based complaint search. The query is embedded once and compared with stored
 * complaint embeddings (bounded scan of the most recent ones - no vector database). If the
 * embedding service is unavailable it transparently falls back to keyword search and says so
 * via `mode`, so the UI never presents keyword results as semantic ones.
 */
async function search(query, { limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const embedded = await embeddingService.generateEmbedding(query);

  if (!embedded.success) {
    const result = await complaintModel.list({ search: query }, { page: 1, limit: safeLimit });
    return { mode: 'keyword', reason: embedded.failureReason, results: result.rows.map((c) => ({ ...c, similarity: null })) };
  }

  const stored = await embeddingModel.listRecent(2000);
  const scored = stored
    .map((e) => ({ id: e.complaint_id, similarity: cosineSimilarity(embedded.embedding, e.embedding) }))
    .filter((s) => s.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, safeLimit);

  if (scored.length === 0) return { mode: 'semantic', results: [] };

  const [rows] = await pool.query(
    `SELECT c.*, d.name AS department_name FROM complaints c LEFT JOIN departments d ON d.id = c.department_id
     WHERE c.id IN (${scored.map(() => '?').join(',')})`,
    scored.map((s) => s.id)
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    mode: 'semantic',
    results: scored.filter((s) => byId.has(s.id)).map((s) => ({ ...byId.get(s.id), similarity: Number(s.similarity.toFixed(3)) })),
  };
}

module.exports = { search };
