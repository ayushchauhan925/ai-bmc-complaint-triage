const complaintService = require('../services/complaint/complaint.service');
const timelineService = require('../services/complaint/timeline.service');
const slaService = require('../services/complaint/sla.service');
const slaPolicyService = require('../services/complaint/slaPolicy.service');
const humanReviewService = require('../services/review/humanReview.service');
const duplicateDetectionService = require('../services/duplicate/duplicateDetection.service');
const decisionModel = require('../models/decision.model');
const duplicateModel = require('../models/duplicate.model');
const complaintModel = require('../models/complaint.model');
const embeddingModel = require('../models/embedding.model');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ROLES } = require('../utils/constants');

async function loadOwned(req) {
  const complaint = await complaintModel.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found.', 404);
  complaintService.assertOwnerOrStaff(complaint, req.user);
  return complaint;
}

// Citizens see their own timeline with internal events/notes removed; staff see everything.
const getTimeline = asyncHandler(async (req, res) => {
  const complaint = await loadOwned(req);
  const timeline = await timelineService.getTimeline(complaint.id, { forCitizen: req.user.role === ROLES.CITIZEN });
  res.status(200).json({ success: true, data: { timeline } });
});

const getSla = asyncHandler(async (req, res) => {
  const complaint = await loadOwned(req);
  const policy = await slaPolicyService.resolvePolicy(complaint.priority_level, complaint.category);
  res.status(200).json({ success: true, data: { sla: slaService.slaSnapshot(complaint, policy.warningPct) } });
});

// Staff-only: evidence + decision internals are operational data, not citizen-facing.
const getEvidence = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found.', 404);
  const decision = await decisionModel.findByComplaintId(complaint.id);
  if (!decision) {
    return res.status(200).json({ success: true, data: { available: false, reason: 'This complaint has not been through the decision pipeline yet.' } });
  }
  res.status(200).json({
    success: true,
    data: {
      available: true,
      score: decision.evidence_score,
      band: decision.evidence_band,
      indicators: decision.evidence_signals?.indicators || [],
      signals: decision.evidence_signals?.signals || [],
      redFlags: decision.evidence_signals?.redFlags || [],
    },
  });
});

const getDecisionTrace = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found.', 404);
  const [decision, reviews] = await Promise.all([
    decisionModel.findByComplaintId(complaint.id),
    humanReviewService.listForComplaint(complaint.id),
  ]);
  if (!decision) {
    return res.status(200).json({ success: true, data: { available: false, reason: 'This complaint has not been through the decision pipeline yet.' } });
  }
  res.status(200).json({
    success: true,
    data: {
      available: true,
      engineVersion: decision.engine_version,
      ai: decision.ai_output
        ? {
            category: decision.ai_output.category,
            subcategory: decision.ai_output.subcategory,
            confidence: decision.ai_output.confidence ?? 0,
            urgency: decision.ai_output.urgency || 'NORMAL',
            riskIndicators: decision.ai_output.risk_indicators || [],
            locationRelevance: decision.ai_output.location_relevance || null,
            explanationFactors: decision.ai_output.explanation_factors || [],
            recommendedAction: decision.ai_output.recommended_action,
            severitySignals: decision.ai_output.severity_signals,
          }
        : null,
      evidence: { score: decision.evidence_score, band: decision.evidence_band, indicators: decision.evidence_signals?.indicators || [] },
      priority: {
        baseScore: decision.base_priority_score,
        finalScore: decision.final_priority_score,
        finalLevel: decision.final_priority_level,
        current: { score: complaint.priority_score, level: complaint.priority_level },
      },
      factors: decision.decision_factors || [],
      humanReviewRequired: !!decision.human_review_required,
      reviewReasons: decision.review_reasons || [],
      reviewStatus: complaint.review_status,
      reviews: reviews || [],
      note: 'Only auditable decision factors are shown - no model reasoning is stored.',
    },
  });
});

// Persisted duplicate/related suggestions (with review state). Falls back to a live lookup
// for complaints analysed before persistence existed.
const getDuplicates = asyncHandler(async (req, res) => {
  const complaint = await loadOwned(req);
  const isStaff = req.user.role !== ROLES.CITIZEN;
  let stored = await duplicateModel.listForComplaint(complaint.id);

  if (stored.length === 0) {
    const embeddingRow = await embeddingModel.findByComplaintId(complaint.id);
    const live = await duplicateDetectionService.findRelatedComplaints({
      complaintId: complaint.id,
      description: complaint.description,
      category: complaint.category,
      latitude: Number(complaint.latitude),
      longitude: Number(complaint.longitude),
      embedding: embeddingRow?.embedding || null,
      allowTextFallback: true,
    });
    stored = live.map((r) => ({
      related_complaint_id: r.complaint.id,
      complaint_number: r.complaint.complaint_number,
      category: r.complaint.category,
      status: r.complaint.status,
      incident_id: r.complaint.incident_id,
      related_created_at: r.complaint.created_at,
      duplicate_probability: r.duplicateProbability,
      semantic_score: r.method === 'semantic' ? r.semanticScore : null,
      text_score: r.textScore,
      distance_meters: Math.round(r.distanceMeters),
      image_similarity: r.imageSimilarity,
      indicators: r.indicators,
      review_status: 'SUGGESTED',
      persisted: false,
    }));
  }

  const duplicates = stored.map((d) => ({
    relatedComplaintId: d.related_complaint_id,
    complaintNumber: d.complaint_number,
    category: d.category,
    status: d.status,
    incidentId: d.incident_id,
    reportedAt: d.related_created_at,
    duplicateProbability: Number(d.duplicate_probability),
    semanticScore: d.semantic_score === null ? null : Number(d.semantic_score),
    textScore: d.text_score === null ? null : Number(d.text_score),
    distanceMeters: d.distance_meters,
    imageSimilarity: d.image_similarity === null ? null : Number(d.image_similarity),
    indicators: d.indicators || [],
    reviewStatus: d.review_status,
    excerpt: isStaff ? d.description_excerpt : undefined,
    shouldLinkToIncident: Number(d.duplicate_probability) >= 0.6 && d.review_status !== 'REJECTED',
  }));
  res.status(200).json({ success: true, data: { duplicates, incidentId: complaint.incident_id } });
});

module.exports = { getTimeline, getSla, getEvidence, getDecisionTrace, getDuplicates };
