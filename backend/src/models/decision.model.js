const { pool } = require('../config/db');

async function upsert(complaintId, d) {
  await pool.query(
    `INSERT INTO complaint_decisions
       (complaint_id, engine_version, ai_output, evidence_score, evidence_band, evidence_signals, decision_factors,
        base_priority_score, final_priority_score, final_priority_level, human_review_required, review_reasons)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       engine_version = VALUES(engine_version), ai_output = VALUES(ai_output),
       evidence_score = VALUES(evidence_score), evidence_band = VALUES(evidence_band),
       evidence_signals = VALUES(evidence_signals), decision_factors = VALUES(decision_factors),
       base_priority_score = VALUES(base_priority_score), final_priority_score = VALUES(final_priority_score),
       final_priority_level = VALUES(final_priority_level), human_review_required = VALUES(human_review_required),
       review_reasons = VALUES(review_reasons)`,
    [
      complaintId,
      d.engineVersion,
      d.aiOutput ? JSON.stringify(d.aiOutput) : null,
      d.evidenceScore ?? null,
      d.evidenceBand ?? null,
      d.evidenceSignals ? JSON.stringify(d.evidenceSignals) : null,
      d.decisionFactors ? JSON.stringify(d.decisionFactors) : null,
      d.basePriorityScore ?? null,
      d.finalPriorityScore ?? null,
      d.finalPriorityLevel ?? null,
      d.humanReviewRequired ? 1 : 0,
      d.reviewReasons ? JSON.stringify(d.reviewReasons) : null,
    ]
  );
}

async function findByComplaintId(complaintId) {
  const [rows] = await pool.query('SELECT * FROM complaint_decisions WHERE complaint_id = ?', [complaintId]);
  return rows[0] || null;
}

module.exports = { upsert, findByComplaintId };
