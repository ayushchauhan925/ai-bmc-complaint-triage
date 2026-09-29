const {
  CATEGORY_BASE_SEVERITY,
  BASE_SEVERITY_SCORE,
  PRIORITY_WEIGHTS,
  PRIORITY_LEVEL_THRESHOLDS,
} = require('../../utils/constants');

const SIGNAL_LABELS = {
  traffic_hazard: 'Traffic hazard',
  near_school: 'Near a school',
  near_hospital: 'Near a hospital',
  near_public_place: 'Near a public place',
  injury_reported: 'Injury reported',
  emergency_access_blocked: 'Emergency access blocked',
  water_accumulation: 'Water accumulation',
  public_health_risk: 'Public health risk',
  environmental_risk: 'Environmental risk',
  multiple_people_affected: 'Multiple people affected',
  large_damage: 'Significant damage',
};

function scoreForDuplicateCount(count) {
  const bracket = PRIORITY_WEIGHTS.duplicates.find((b) => count >= b.min && count <= b.max);
  return bracket ? bracket.score : 0;
}

function scoreForAgeHours(hours) {
  const bracket = PRIORITY_WEIGHTS.age.find((b) => hours >= b.hoursMin && hours < b.hoursMax);
  return bracket ? bracket.score : 0;
}

function levelForScore(score) {
  const bracket = PRIORITY_LEVEL_THRESHOLDS.find((b) => score >= b.min && score <= b.max);
  return bracket ? bracket.level : 'LOW';
}

/**
 * Deterministic priority engine (Section 9). The LLM only supplies severity_signals;
 * this function - not the model - decides the final score and level.
 */
function calculatePriority({ category, severitySignals = {}, relatedComplaintCount = 0, createdAt = new Date() }) {
  const reasons = [];

  const baseTier = CATEGORY_BASE_SEVERITY[category] || 'LOW';
  const baseScore = BASE_SEVERITY_SCORE[baseTier];
  reasons.push({ label: `${category.replace(/_/g, ' ')} (base severity: ${baseTier})`, points: baseScore });

  let score = baseScore;

  for (const [signal, weight] of Object.entries(PRIORITY_WEIGHTS.signals)) {
    if (severitySignals[signal]) {
      score += weight;
      reasons.push({ label: SIGNAL_LABELS[signal] || signal, points: weight });
    }
  }

  const dupScore = scoreForDuplicateCount(relatedComplaintCount);
  if (dupScore > 0) {
    score += dupScore;
    reasons.push({ label: `${relatedComplaintCount} related complaint(s)`, points: dupScore });
  }

  const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  const ageScore = scoreForAgeHours(ageHours);
  if (ageScore > 0) {
    score += ageScore;
    reasons.push({ label: 'Complaint has been open for a while', points: ageScore });
  }

  score = Math.min(score, PRIORITY_WEIGHTS.maxScore);
  const level = levelForScore(score);

  return { score, level, reasons };
}

module.exports = { calculatePriority, levelForScore };
