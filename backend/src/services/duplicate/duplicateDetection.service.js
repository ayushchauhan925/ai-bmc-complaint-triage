const complaintModel = require('../../models/complaint.model');
const embeddingModel = require('../../models/embedding.model');
const { cosineSimilarity, haversineDistanceMeters } = require('../../utils/vectorMath');
const { DUPLICATE_DETECTION } = require('../../utils/constants');

/**
 * Practical duplicate/related-complaint detection (Section 11): combines semantic
 * similarity (OpenAI embeddings), geographic proximity and recency. No separate vector
 * database - similarity is computed in Node against a geo/time-prefiltered candidate set.
 */
async function findRelatedComplaints({
  complaintId,
  description,
  latitude,
  longitude,
  embedding,
  semanticSimilarityThreshold = DUPLICATE_DETECTION.semanticSimilarityThreshold,
  combinedScoreThreshold = DUPLICATE_DETECTION.combinedScoreThreshold,
}) {
  if (!embedding) return [];

  const sinceDate = new Date(Date.now() - DUPLICATE_DETECTION.timeWindowHours * 60 * 60 * 1000);

  const candidates = await complaintModel.findNearby({
    latitude,
    longitude,
    radiusMeters: DUPLICATE_DETECTION.searchRadiusMeters,
    sinceDate,
    excludeId: complaintId,
  });

  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c) => c.id);
  const candidateEmbeddings = await embeddingModel.findByComplaintIds(candidateIds);
  const embeddingByComplaintId = new Map(candidateEmbeddings.map((e) => [e.complaint_id, e.embedding]));

  const now = Date.now();
  const results = [];

  for (const candidate of candidates.slice(0, DUPLICATE_DETECTION.maxCandidates)) {
    const candidateEmbedding = embeddingByComplaintId.get(candidate.id);
    if (!candidateEmbedding) continue;

    const semanticScore = cosineSimilarity(embedding, candidateEmbedding);
    const distanceMeters = haversineDistanceMeters(latitude, longitude, candidate.latitude, candidate.longitude);
    const distanceScore = Math.max(0, 1 - distanceMeters / DUPLICATE_DETECTION.searchRadiusMeters);

    const hoursAgo = (now - new Date(candidate.created_at).getTime()) / (1000 * 60 * 60);
    const timeScore = Math.max(0, 1 - hoursAgo / DUPLICATE_DETECTION.timeWindowHours);

    const combinedScore =
      semanticScore * DUPLICATE_DETECTION.weights.semantic +
      distanceScore * DUPLICATE_DETECTION.weights.distance +
      timeScore * DUPLICATE_DETECTION.weights.time;

    if (semanticScore >= semanticSimilarityThreshold && combinedScore >= combinedScoreThreshold) {
      results.push({
        complaint: candidate,
        semanticScore,
        distanceMeters,
        combinedScore,
      });
    }
  }

  results.sort((a, b) => b.combinedScore - a.combinedScore);
  return results;
}

module.exports = { findRelatedComplaints };
