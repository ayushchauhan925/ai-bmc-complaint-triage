const priorityService = require('../complaint/priority.service');
const { DECISION_ENGINE, PRIORITY_LEVEL_THRESHOLDS } = require('../../utils/constants');

const LEVEL_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const LEVEL_MIN_SCORE = Object.fromEntries(PRIORITY_LEVEL_THRESHOLDS.map((t) => [t.level, t.min]));

/**
 * Hybrid, explainable decision engine.
 *
 * The LLM contributes *signals* (category, severity signals, risk indicators, urgency,
 * confidence). Everything that affects an outcome is decided here by bounded, named rules:
 *
 *   base priority (category + AI signals + duplicate volume + age)     [priority.service]
 *   + AI risk indicators not already captured by a signal   (capped)
 *   + recurring-location history                            (historical pattern)
 *   +/- evidence adjustment                                 (evidence intelligence)
 *   then safety floors (injury / blocked emergency access guarantee >= HIGH)
 *   then human-review gates (weak evidence + high priority, unverified "immediate", ...)
 *
 * It is deliberately NOT an average of scores: floors and review gates are hard rules, and
 * every step is returned as a factor so the outcome can be audited and challenged.
 *
 * Pure function - no I/O - so it is fully unit-testable.
 */
function decide({
  category,
  ai,
  evidence,
  relatedCount = 0,
  incident = null,
  historyRepeatCount = 0,
  createdAt = new Date(),
  externalReviewReasons = [],
  injectionSuspected = false,
}) {
  const factors = [];
  const cfg = DECISION_ENGINE;
  const signals = ai?.severity_signals || {};

  // 1. Deterministic base (category tier + signals + related volume + age). Reused unchanged.
  const base = priorityService.calculatePriority({
    category,
    severitySignals: signals,
    relatedComplaintCount: relatedCount,
    createdAt,
  });
  for (const r of base.reasons) {
    factors.push({ source: 'RULE', label: r.label, points: r.points });
  }
  let score = base.score;

  // 2. AI risk indicators - only those not already represented by a severity signal, capped.
  let riskBudget = cfg.riskIndicatorCap;
  for (const indicator of ai?.risk_indicators || []) {
    const pts = cfg.riskIndicatorPoints[indicator];
    if (!pts || riskBudget <= 0) continue;
    if (indicator === 'INJURY_RISK' && signals.injury_reported) continue;
    if (indicator === 'VULNERABLE_GROUPS_AFFECTED' && (signals.near_school || signals.near_hospital)) continue;
    const applied = Math.min(pts, riskBudget);
    riskBudget -= applied;
    score += applied;
    factors.push({ source: 'AI', label: `AI risk indicator: ${indicator.replace(/_/g, ' ').toLowerCase()}`, points: applied });
  }

  // 3. Historical pattern: same category keeps recurring at this location.
  if (historyRepeatCount > 0) {
    score += cfg.repeatLocation.points;
    factors.push({ source: 'HISTORY', label: `Recurring issue at this location (${historyRepeatCount} earlier report(s))`, points: cfg.repeatLocation.points });
  }

  // 4. Evidence adjustment - verified reports move up a little, unverifiable ones down a little.
  if (evidence) {
    const adj = cfg.evidenceAdjustment[evidence.band];
    if (adj) {
      score += adj;
      factors.push({ source: 'EVIDENCE', label: `${evidence.band === 'STRONG' ? 'Strong' : 'Insufficient'} supporting evidence (score ${evidence.score})`, points: adj });
    }
  }

  if (incident && incident.complaintCount > 1) {
    factors.push({ source: 'SIMILARITY', label: `Part of an incident with ${incident.complaintCount} complaints`, points: 0 });
  }

  score = Math.max(0, Math.min(100, score));
  let level = priorityService.levelForScore(score);

  // 5. Safety floors - hard guarantees no score arithmetic can undercut.
  for (const floor of cfg.safetyFloors) {
    if (signals[floor.signal] && LEVEL_RANK[level] < LEVEL_RANK[floor.level]) {
      const min = LEVEL_MIN_SCORE[floor.level];
      factors.push({ source: 'RULE', label: `Safety floor: ${floor.label.toLowerCase()} guarantees at least ${floor.level}`, points: min - score });
      score = min;
      level = floor.level;
    }
  }

  // 6. Human-review gates.
  const reviewReasons = [...externalReviewReasons];
  if (!ai) {
    reviewReasons.push('AI analysis unavailable - needs manual classification.');
  } else {
    if (ai.confidence < cfg.lowConfidenceReview) reviewReasons.push('Low AI confidence in classification.');
    if (category === 'OTHER' && ai.confidence < cfg.otherCategoryReviewConfidence) {
      reviewReasons.push('Could not confidently place this complaint in a specific category.');
    }
    if (ai.moderation?.is_spam_or_irrelevant) {
      reviewReasons.push(ai.moderation.reason || 'Flagged as possibly spam or irrelevant.');
    }
    if (ai.urgency === 'IMMEDIATE') {
      const supported = ai.confidence >= cfg.immediateUrgencyMinConfidence && evidence && evidence.band !== 'INSUFFICIENT';
      if (LEVEL_RANK[level] < LEVEL_RANK.HIGH) {
        if (supported) {
          const min = LEVEL_MIN_SCORE.HIGH;
          factors.push({ source: 'AI', label: 'AI flagged immediate urgency (corroborated by confidence and evidence) - raised to HIGH', points: min - score });
          score = min;
          level = 'HIGH';
        } else {
          reviewReasons.push('AI flagged immediate urgency but evidence/confidence is too weak to raise priority automatically.');
        }
      }
    }
  }
  if (injectionSuspected) reviewReasons.push('Complaint text contains instruction-like content.');
  if (evidence && LEVEL_RANK[level] >= LEVEL_RANK.HIGH && (evidence.band === 'WEAK' || evidence.band === 'INSUFFICIENT') && relatedCount === 0) {
    reviewReasons.push(`${level} priority rests on weak, uncorroborated evidence - verify before dispatch.`);
  }
  if (ai && ai.location_relevance === 'MISSING' && LEVEL_RANK[level] >= LEVEL_RANK.HIGH && !ai.normalized_description) {
    reviewReasons.push('High priority but no usable location detail in the text.');
  }

  const reasons = factors.filter((f) => f.points !== 0 || f.source === 'RULE');
  return {
    engineVersion: cfg.version,
    priority: { score, level, baseScore: base.score, baseLevel: base.level },
    factors,
    // Legacy shape consumed by existing UI (priority_reasons column).
    priorityReasons: reasons.map((f) => ({ label: f.label, points: f.points })),
    humanReviewRequired: reviewReasons.length > 0,
    reviewReasons: [...new Set(reviewReasons)],
  };
}

module.exports = { decide };
