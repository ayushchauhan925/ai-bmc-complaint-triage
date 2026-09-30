const { pool } = require('../../config/db');
const duplicateModel = require('../../models/duplicate.model');

const MIN_SAMPLE = 5; // below this, rates are reported but flagged as low-sample

const rate = (num, den) => (den > 0 ? Number((num / den).toFixed(3)) : null);

/**
 * AI-vs-human evaluation metrics computed from staff reviews. Only reviewed complaints are
 * counted (an unreviewed complaint says nothing about accuracy), and every rate carries its
 * sample size. With no reviews the answer is explicitly "insufficient", never a made-up
 * number. This is evaluation data - nothing here retrains a model.
 */
async function getMetrics({ days = 90 } = {}) {
  const safeDays = Math.min(Math.max(Number(days) || 90, 1), 730);

  // Latest AI-decision review (APPROVE/CORRECT) per complaint inside the window.
  const [decisionRows] = await pool.query(
    `SELECT r.* FROM human_reviews r
     JOIN (SELECT complaint_id, MAX(id) AS max_id FROM human_reviews
           WHERE action IN ('APPROVE', 'CORRECT') AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
           GROUP BY complaint_id) latest ON latest.max_id = r.id`,
    [safeDays]
  );
  const [[fp]] = await pool.query(
    `SELECT COUNT(DISTINCT complaint_id) AS n FROM human_reviews
     WHERE action = 'FALSE_POSITIVE' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [safeDays]
  );

  const reviewed = decisionRows.length;
  const approvals = decisionRows.filter((r) => r.action === 'APPROVE').length;
  const categoryAgree = decisionRows.filter((r) => r.ai_category === r.human_category).length;
  const priorityAgree = decisionRows.filter((r) => r.ai_priority_level === r.human_priority_level).length;
  const departmentAgree = decisionRows.filter((r) => r.ai_department_id === r.human_department_id).length;

  // Calibration: does reported AI confidence line up with being right?
  const [confRows] = await pool.query(
    `SELECT r.ai_category = r.human_category AS category_correct, c.ai_confidence
     FROM human_reviews r JOIN complaints c ON c.id = r.complaint_id
     JOIN (SELECT complaint_id, MAX(id) AS max_id FROM human_reviews
           WHERE action IN ('APPROVE', 'CORRECT') AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
           GROUP BY complaint_id) latest ON latest.max_id = r.id
     WHERE c.ai_confidence IS NOT NULL`,
    [safeDays]
  );
  const avg = (arr) => (arr.length ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(3)) : null);
  const correctConf = confRows.filter((r) => r.category_correct).map((r) => Number(r.ai_confidence));
  const wrongConf = confRows.filter((r) => !r.category_correct).map((r) => Number(r.ai_confidence));

  // Distribution of AI confidence across ALL analysed complaints (independent of review).
  const [confDist] = await pool.query(
    `SELECT FLOOR(ai_confidence * 10) AS bucket, COUNT(*) AS count
     FROM complaints WHERE ai_confidence IS NOT NULL GROUP BY bucket ORDER BY bucket`
  );

  const dup = await duplicateModel.precisionStats();
  const dupReviewed = dup.confirmed + dup.rejected;

  return {
    windowDays: safeDays,
    sufficientData: reviewed >= MIN_SAMPLE,
    minSample: MIN_SAMPLE,
    reviewedDecisions: reviewed,
    classificationAccuracy: rate(categoryAgree, reviewed),
    priorityAgreement: rate(priorityAgree, reviewed),
    departmentRoutingAgreement: rate(departmentAgree, reviewed),
    approvalRate: rate(approvals, reviewed),
    correctionRate: rate(reviewed - approvals, reviewed),
    falsePositives: Number(fp.n),
    duplicate: {
      confirmed: dup.confirmed,
      rejected: dup.rejected,
      pendingSuggestions: dup.pending,
      precision: rate(dup.confirmed, dupReviewed),
      sufficientData: dupReviewed >= MIN_SAMPLE,
    },
    calibration: {
      avgConfidenceWhenCorrect: avg(correctConf),
      avgConfidenceWhenCorrected: avg(wrongConf),
      samples: confRows.length,
    },
    confidenceDistribution: confDist.map((r) => ({
      range: `${Number(r.bucket) * 10}-${Math.min(Number(r.bucket) * 10 + 10, 100)}%`,
      count: Number(r.count),
    })),
    note: 'Computed only from staff-reviewed complaints. Used for evaluation; production models are never retrained from unverified feedback.',
  };
}

module.exports = { getMetrics };
