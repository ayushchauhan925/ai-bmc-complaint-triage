const complaintModel = require('../../models/complaint.model');
const embeddingModel = require('../../models/embedding.model');
const { cosineSimilarity, haversineDistanceMeters } = require('../../utils/vectorMath');
const { textSimilarity } = require('../../utils/textSimilarity');
const { DUPLICATE_DETECTION, CATEGORY_TO_DEPARTMENT } = require('../../utils/constants');

const clamp01 = (n) => Math.max(0, Math.min(1, n));

// Text-only fallback thresholds (no embeddings available). Stricter than the semantic path
// because lexical overlap is a weaker signal than embedding similarity.
const TEXT_FALLBACK = { textThreshold: 0.55, combinedThreshold: 0.62, weights: { text: 0.6, distance: 0.25, time: 0.15 } };

function sameCategoryFamily(a, b) {
  if (!a || !b) return null; // unknown
  if (a === b) return true;
  return CATEGORY_TO_DEPARTMENT[a] && CATEGORY_TO_DEPARTMENT[a] === CATEGORY_TO_DEPARTMENT[b];
}

/**
 * Calibrated duplicate probability (0..1) from independent signals. It is a *ranking and
 * explanation* aid - linking decisions still use the thresholds/rules in the callers, and
 * nothing is ever deleted based on it.
 */
function duplicateProbability({ semanticScore, textScore, distanceScore, timeScore, categoryMatch, imageSimilarity }) {
  const cat = categoryMatch === null ? 0.5 : categoryMatch ? 1 : 0;
  let p =
    semanticScore === null || semanticScore === undefined
      ? 0.55 * textScore + 0.2 * distanceScore + 0.1 * timeScore + 0.15 * cat
      : 0.45 * semanticScore + 0.2 * textScore + 0.15 * distanceScore + 0.1 * timeScore + 0.1 * cat;
  if (imageSimilarity !== null && imageSimilarity !== undefined) {
    p = 0.8 * p + 0.2 * imageSimilarity;
  }
  return Number(clamp01(p).toFixed(3));
}

function buildIndicators({ semanticScore, textScore, distanceMeters, hoursAgo, categoryMatch, imageSimilarity }) {
  const indicators = [];
  if (semanticScore !== null && semanticScore !== undefined) {
    indicators.push(semanticScore >= 0.9 ? 'Very similar meaning' : semanticScore >= 0.82 ? 'Similar meaning' : 'Related meaning');
  }
  if (textScore >= 0.5) indicators.push('Shared wording');
  indicators.push(distanceMeters <= 50 ? 'Same spot (<50 m)' : `${Math.round(distanceMeters)} m away`);
  indicators.push(hoursAgo < 24 ? 'Reported within 24 h' : `Reported ${Math.round(hoursAgo / 24)} day(s) earlier`);
  if (categoryMatch === true) indicators.push('Same category');
  if (categoryMatch === false) indicators.push('Different category');
  if (imageSimilarity !== null && imageSimilarity !== undefined && imageSimilarity >= 0.85) indicators.push('Visually similar photo');
  return indicators;
}

/**
 * Duplicate / related-complaint detection. Combines semantic similarity (embeddings),
 * lexical similarity, geographic proximity, recency and category agreement.
 *
 * - With an embedding: candidates must pass the semantic + combined thresholds (unchanged
 *   behaviour), and each result additionally carries text score, category match, a duplicate
 *   probability and human-readable indicators.
 * - Without an embedding (AI/embedding outage): degrades to a stricter text-only match so
 *   duplicate awareness does not disappear entirely when OpenAI is down.
 *
 * Candidates are geo/time-prefiltered in SQL; scoring is done in Node (no vector DB).
 */
async function findRelatedComplaints({
  complaintId,
  description,
  category = null,
  latitude,
  longitude,
  embedding,
  semanticSimilarityThreshold = DUPLICATE_DETECTION.semanticSimilarityThreshold,
  combinedScoreThreshold = DUPLICATE_DETECTION.combinedScoreThreshold,
  allowTextFallback = false,
}) {
  if (!embedding && !allowTextFallback) return [];

  const sinceDate = new Date(Date.now() - DUPLICATE_DETECTION.timeWindowHours * 60 * 60 * 1000);

  const candidates = await complaintModel.findNearby({
    latitude,
    longitude,
    radiusMeters: DUPLICATE_DETECTION.searchRadiusMeters,
    sinceDate,
    excludeId: complaintId,
  });

  if (!candidates || candidates.length === 0) return [];

  const limited = candidates.slice(0, DUPLICATE_DETECTION.maxCandidates);
  let embeddingByComplaintId = new Map();
  if (embedding) {
    const candidateEmbeddings = await embeddingModel.findByComplaintIds(limited.map((c) => c.id));
    embeddingByComplaintId = new Map(candidateEmbeddings.map((e) => [e.complaint_id, e.embedding]));
  }

  const now = Date.now();
  const results = [];

  for (const candidate of limited) {
    const candidateEmbedding = embeddingByComplaintId.get(candidate.id);
    const useSemantic = Boolean(embedding && candidateEmbedding);
    if (embedding && !candidateEmbedding && !allowTextFallback) continue;

    const distanceMeters = haversineDistanceMeters(latitude, longitude, candidate.latitude, candidate.longitude);
    const distanceScore = Math.max(0, 1 - distanceMeters / DUPLICATE_DETECTION.searchRadiusMeters);
    const hoursAgo = (now - new Date(candidate.created_at).getTime()) / (1000 * 60 * 60);
    const timeScore = Math.max(0, 1 - hoursAgo / DUPLICATE_DETECTION.timeWindowHours);
    const textScore = candidate.description ? textSimilarity(description, candidate.description) : 0;
    const categoryMatch = sameCategoryFamily(category, candidate.category);

    let semanticScore = null;
    let combinedScore;
    let accepted;

    if (useSemantic) {
      semanticScore = cosineSimilarity(embedding, candidateEmbedding);
      combinedScore =
        semanticScore * DUPLICATE_DETECTION.weights.semantic +
        distanceScore * DUPLICATE_DETECTION.weights.distance +
        timeScore * DUPLICATE_DETECTION.weights.time;
      accepted = semanticScore >= semanticSimilarityThreshold && combinedScore >= combinedScoreThreshold;
    } else {
      const w = TEXT_FALLBACK.weights;
      combinedScore = textScore * w.text + distanceScore * w.distance + timeScore * w.time;
      accepted = textScore >= TEXT_FALLBACK.textThreshold && combinedScore >= TEXT_FALLBACK.combinedThreshold && categoryMatch !== false;
    }

    if (!accepted) continue;

    const probability = duplicateProbability({ semanticScore, textScore, distanceScore, timeScore, categoryMatch, imageSimilarity: null });
    results.push({
      complaint: candidate,
      semanticScore: semanticScore === null ? 0 : semanticScore,
      textScore: Number(textScore.toFixed(3)),
      distanceMeters,
      combinedScore,
      categoryMatch,
      duplicateProbability: probability,
      method: useSemantic ? 'semantic' : 'text',
      indicators: buildIndicators({ semanticScore, textScore, distanceMeters, hoursAgo, categoryMatch, imageSimilarity: null }),
      imageSimilarity: null,
    });
  }

  results.sort((a, b) => b.combinedScore - a.combinedScore);
  return results;
}

/** Folds photo similarity into results already found, updating probability + indicators. */
function applyImageSimilarity(results, similarityByComplaintId) {
  for (const r of results) {
    const sim = similarityByComplaintId.get(r.complaint.id);
    if (sim === undefined) continue;
    r.imageSimilarity = Number(sim.toFixed(3));
    r.duplicateProbability = duplicateProbability({
      semanticScore: r.method === 'semantic' ? r.semanticScore : null,
      textScore: r.textScore,
      distanceScore: Math.max(0, 1 - r.distanceMeters / DUPLICATE_DETECTION.searchRadiusMeters),
      timeScore: Math.max(0, 1 - (Date.now() - new Date(r.complaint.created_at).getTime()) / 3600000 / DUPLICATE_DETECTION.timeWindowHours),
      categoryMatch: r.categoryMatch,
      imageSimilarity: sim,
    });
    if (sim >= 0.85 && !r.indicators.includes('Visually similar photo')) r.indicators.push('Visually similar photo');
  }
  return results;
}

/**
 * Whether the new complaint should be linked to an incident with these matches: the match
 * must be strong and category-compatible. Different-category neighbours are related but are
 * not treated as the same real-world incident.
 */
function linkableResults(results) {
  return results.filter((r) => r.categoryMatch !== false && r.duplicateProbability >= DUPLICATE_DETECTION.linkProbability);
}

module.exports = {
  findRelatedComplaints,
  applyImageSimilarity,
  linkableResults,
  duplicateProbability,
  sameCategoryFamily,
};
