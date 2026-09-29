const complaintService = require('../services/complaint/complaint.service');
const statusService = require('../services/complaint/status.service');
const reopenService = require('../services/complaint/reopen.service');
const complaintModel = require('../models/complaint.model');
const embeddingModel = require('../models/embedding.model');
const { runAnalysisPipeline } = require('../services/complaint/analysisPipeline.service');
const duplicateDetectionService = require('../services/duplicate/duplicateDetection.service');
const embeddingService = require('../services/ai/embedding.service');
const guidedAssistantService = require('../services/ai/guidedAssistant.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ROLES, DUPLICATE_DETECTION } = require('../utils/constants');
const logger = require('../utils/logger');

function projectDuplicates(related) {
  return related.map((r) => ({
    complaint_id: r.complaint.id,
    complaint_number: r.complaint.complaint_number,
    category: r.complaint.category,
    status: r.complaint.status,
    incident_id: r.complaint.incident_id,
    created_at: r.complaint.created_at,
    similarity: Number(r.semanticScore.toFixed(3)),
    distance_meters: Math.round(r.distanceMeters),
    combined_score: Number(r.combinedScore.toFixed(3)),
  }));
}

const create = asyncHandler(async (req, res) => {
  const { description, latitude, longitude, address } = req.body;
  const complaint = await complaintService.createComplaint({
    userId: req.user.id,
    description,
    latitude,
    longitude,
    address,
    imageFiles: req.files || [],
  });

  // Run the AI -> priority -> routing -> duplicate/incident pipeline synchronously so the
  // citizen sees the full result immediately (Section 49 demo flow). If it throws for a
  // reason other than a handled AI failure, the complaint still exists as SUBMITTED and
  // can be retried via POST /:id/analyze - submission itself never fails because of AI.
  try {
    const analyzed = await runAnalysisPipeline(complaint.id);
    const full = await complaintService.getComplaintDetail(complaint.id);
    return res.status(201).json({
      success: true,
      data: { complaint: { ...full, relatedCount: analyzed?.relatedCount, incidentId: analyzed?.incidentId } },
    });
  } catch (err) {
    logger.error('Analysis pipeline threw unexpectedly; complaint remains SUBMITTED for manual handling.', {
      complaintId: complaint.id,
      error: err.message,
    });
    const full = await complaintService.getComplaintDetail(complaint.id);
    return res.status(201).json({ success: true, data: { complaint: full } });
  }
});

const analyze = asyncHandler(async (req, res) => {
  await runAnalysisPipeline(req.params.id);
  const complaint = await complaintService.getComplaintDetail(req.params.id);
  res.status(200).json({ success: true, data: { complaint } });
});

const verifyImage = asyncHandler(async (req, res) => {
  // Re-runs the same structured analysis, which already includes image_analysis
  // (Section 6). Kept as its own endpoint per the API spec for targeted re-checks.
  await runAnalysisPipeline(req.params.id);
  const complaint = await complaintService.getComplaintDetail(req.params.id);
  res.status(200).json({
    success: true,
    data: {
      image_verified: complaint.image_verified,
      review_required: !!complaint.review_required,
      review_reason: complaint.review_reason,
    },
  });
});

const getDuplicates = asyncHandler(async (req, res) => {
  const complaint = await complaintService.getComplaintDetail(req.params.id);
  complaintService.assertOwnerOrStaff(complaint, req.user);

  const embeddingRow = await embeddingModel.findByComplaintId(complaint.id);
  if (!embeddingRow) {
    return res.status(200).json({ success: true, data: { duplicates: [] } });
  }

  const related = await duplicateDetectionService.findRelatedComplaints({
    complaintId: complaint.id,
    description: complaint.description,
    latitude: complaint.latitude,
    longitude: complaint.longitude,
    embedding: embeddingRow.embedding,
  });

  res.status(200).json({ success: true, data: { duplicates: projectDuplicates(related) } });
});

// GET alias of the same duplicate/related-complaint lookup, matching the newer API naming.
const getSimilar = getDuplicates;

// Section 16: pre-submission duplicate warning. No complaint is created yet - a fresh
// embedding is generated from the draft text and compared against existing complaints, the
// same way the post-submission pipeline does. Citizens are shown this but are never blocked
// from submitting.
const duplicateCheck = asyncHandler(async (req, res) => {
  const { description, latitude, longitude } = req.body;

  const embeddingResult = await embeddingService.generateEmbedding(description);
  if (!embeddingResult.success) {
    return res.status(200).json({ success: true, data: { duplicates: [], ai_unavailable: true } });
  }

  const related = await duplicateDetectionService.findRelatedComplaints({
    complaintId: undefined,
    description,
    latitude,
    longitude,
    embedding: embeddingResult.embedding,
    semanticSimilarityThreshold: DUPLICATE_DETECTION.preSubmission.semanticSimilarityThreshold,
    combinedScoreThreshold: DUPLICATE_DETECTION.preSubmission.combinedScoreThreshold,
  });

  res.status(200).json({ success: true, data: { duplicates: projectDuplicates(related) } });
});

// Section 1: guided complaint assistant. One-shot, not a chatbot - returns follow-up
// questions + a suggested clearer description the citizen can accept or ignore.
const guidedAssist = asyncHandler(async (req, res) => {
  const result = await guidedAssistantService.getGuidedAssistance(req.body.draft);
  if (!result.success) {
    return res.status(200).json({ success: true, data: { available: false, reason: result.failureReason } });
  }
  res.status(200).json({ success: true, data: { available: true, ...result.assistance } });
});

// Section 17: citizen reopens a RESOLVED complaint with an optional reason + evidence photo.
const reopen = asyncHandler(async (req, res) => {
  const updated = await reopenService.reopenComplaint({
    complaintId: req.params.id,
    user: req.user,
    reason: req.body.reason,
    imageFile: req.file || null,
  });
  res.status(200).json({ success: true, data: { complaint: updated } });
});

// Section 2: AI enrichment projection - re-runs the same unified pipeline and returns just
// the enrichment fields. (There is one AI analysis call, not a second one - see ai-pipeline.md.)
const aiEnrich = asyncHandler(async (req, res) => {
  await runAnalysisPipeline(req.params.id);
  const complaint = await complaintService.getComplaintDetail(req.params.id);
  res.status(200).json({
    success: true,
    data: {
      title: complaint.ai_title,
      summary: complaint.ai_summary,
      category: complaint.category,
      subcategory: complaint.subcategory,
      language: complaint.language,
      confidence: complaint.ai_confidence,
      missing_information: complaint.missing_information,
    },
  });
});

// Section 3: evidence intelligence projection of the same unified pipeline result.
const evidenceAnalysis = asyncHandler(async (req, res) => {
  await runAnalysisPipeline(req.params.id);
  const complaint = await complaintService.getComplaintDetail(req.params.id);
  res.status(200).json({
    success: true,
    data: {
      evidence_confidence: complaint.evidence_confidence,
      evidence: complaint.evidence_analysis,
      image_verified: complaint.image_verified,
      review_required: !!complaint.review_required,
      review_reason: complaint.review_reason,
    },
  });
});

const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, category, priority_level, department_id, ward_id, search } = req.query;
  const filters = { status, category, priority_level, search };

  if (department_id) filters.department_id = Number(department_id);
  if (ward_id) filters.ward_id = Number(ward_id);

  if (req.user.role === ROLES.CITIZEN) {
    filters.user_id = req.user.id;
  } else if (req.user.role === ROLES.OFFICER) {
    filters.officer_id = req.user.id;
  }

  const result = await complaintService.listComplaints(filters, { page: Number(page), limit: Number(limit) });
  res.status(200).json({ success: true, data: result });
});

const getOne = asyncHandler(async (req, res) => {
  const complaint = await complaintService.getComplaintDetail(req.params.id);
  complaintService.assertOwnerOrStaff(complaint, req.user);
  res.status(200).json({ success: true, data: { complaint } });
});

const update = asyncHandler(async (req, res) => {
  await complaintModel.update(req.params.id, req.body);
  const complaint = await complaintService.getComplaintDetail(req.params.id);
  res.status(200).json({ success: true, data: { complaint } });
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  const complaint = await complaintService.getComplaintDetail(req.params.id);

  if (req.user.role === ROLES.OFFICER) {
    if (complaint.officer_id !== req.user.id) {
      throw new AppError('You are not assigned to this complaint.', 403);
    }
  } else if (req.user.role === ROLES.CITIZEN) {
    throw new AppError('You do not have permission to change complaint status.', 403);
  }

  const updated = await statusService.transition(req.params.id, status, req.user, notes);
  res.status(200).json({ success: true, data: { complaint: updated } });
});

module.exports = {
  create,
  list,
  getOne,
  update,
  updateStatus,
  analyze,
  verifyImage,
  getDuplicates,
  getSimilar,
  duplicateCheck,
  reopen,
  aiEnrich,
  evidenceAnalysis,
  guidedAssist,
};
