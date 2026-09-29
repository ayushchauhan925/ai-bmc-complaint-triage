const complaintModel = require('../../models/complaint.model');
const statusService = require('./status.service');
const priorityService = require('./priority.service');
const routingService = require('./routing.service');
const slaService = require('./sla.service');
const complaintAnalysisService = require('../ai/complaintAnalysis.service');
const embeddingService = require('../ai/embedding.service');
const duplicateDetectionService = require('../duplicate/duplicateDetection.service');
const incidentGroupingService = require('../duplicate/incidentGrouping.service');
const notificationService = require('../notification/notification.service');
const logger = require('../../utils/logger');
const { COMPLAINT_STATUS } = require('../../utils/constants');

/**
 * Full AI -> business-logic pipeline for a complaint (Sections 4-12). Orchestrates:
 * AI text+image analysis -> deterministic priority -> deterministic routing ->
 * embeddings -> duplicate detection -> incident grouping -> SLA.
 * The pipeline never throws for AI failures - it degrades gracefully and flags the
 * complaint for manual review instead (rule: app must stay functional if AI fails).
 */
async function runAnalysisPipeline(complaintId) {
  const complaint = await complaintModel.findById(complaintId);
  if (!complaint) return;

  logger.info('AI analysis started.', { complaintId, complaintNumber: complaint.complaint_number });

  const images = await complaintModel.getImages(complaintId);
  const imageUrls = images.map((img) => img.image_url);

  const analysisResult = await complaintAnalysisService.analyzeComplaint({
    description: complaint.description,
    imageUrls,
  });

  if (!analysisResult.success) {
    logger.warn('AI analysis failed for complaint; flagging for manual review.', {
      complaintId,
      reason: analysisResult.failureReason,
    });
    await complaintModel.update(complaintId, {
      ai_analysis_failed: true,
      review_required: true,
      review_reason: 'AI analysis unavailable - needs manual classification.',
    });
    await statusService.transition(
      complaintId,
      COMPLAINT_STATUS.NEEDS_REVIEW,
      null,
      'AI analysis failed. Flagged for manual review.',
      { force: true }
    );
    return complaintModel.findById(complaintId);
  }

  const analysis = analysisResult.analysis;
  const hasImages = imageUrls.length > 0;
  const evidence = analysis.image_analysis;

  // Evidence Intelligence (Section 3): a low-confidence or suspect image is flagged for
  // human review, never auto-rejected.
  let reviewRequired = false;
  const reviewReasons = [];
  if (hasImages && !evidence.image_supports_claim) {
    reviewRequired = true;
    reviewReasons.push('Uploaded image does not clearly support the complaint text.');
  }
  if (hasImages && evidence.likely_irrelevant) {
    reviewRequired = true;
    reviewReasons.push('Uploaded image may be unrelated to the reported issue.');
  }
  if (hasImages && evidence.manipulated_or_suspicious) {
    reviewRequired = true;
    reviewReasons.push('Uploaded image shows possible signs of manipulation.');
  }
  if (hasImages && (!evidence.image_quality_sufficient || evidence.is_blurry)) {
    reviewRequired = true;
    reviewReasons.push('Uploaded image quality may be insufficient to verify the claim.');
  }
  if (analysis.moderation?.is_spam_or_irrelevant) {
    reviewRequired = true;
    reviewReasons.push(analysis.moderation.reason || 'Flagged as possibly spam or irrelevant.');
  }
  if (analysis.confidence < 0.4) {
    reviewRequired = true;
    reviewReasons.push('Low AI confidence in classification.');
  }

  await complaintModel.update(complaintId, {
    ai_title: analysis.title,
    category: analysis.category,
    subcategory: analysis.subcategory,
    language: analysis.language,
    ai_summary: analysis.summary,
    ai_confidence: analysis.confidence,
    missing_information: JSON.stringify(analysis.missing_information || []),
    severity_signals: JSON.stringify(analysis.severity_signals),
    evidence_analysis: hasImages ? JSON.stringify(evidence) : null,
    evidence_confidence: hasImages ? evidence.evidence_confidence : null,
    image_verified: hasImages ? evidence.image_supports_claim : null,
    review_required: reviewRequired,
    review_reason: reviewReasons.join(' ') || null,
    ai_analysis_failed: false,
  });

  await statusService.transition(
    complaintId,
    COMPLAINT_STATUS.AI_ANALYZED,
    null,
    'AI analysis complete.',
    { force: true }
  );
  logger.info('AI analysis completed.', {
    complaintId,
    category: analysis.category,
    confidence: analysis.confidence,
    reviewRequired,
  });

  const department = await routingService.routeToDepartment(analysis.category);

  const embeddingText = `${analysis.summary} ${complaint.description}`;
  const embeddingResult = await embeddingService.generateAndStoreEmbedding(complaintId, embeddingText);

  let relatedResults = [];
  if (embeddingResult.success) {
    relatedResults = await duplicateDetectionService.findRelatedComplaints({
      complaintId,
      description: complaint.description,
      latitude: complaint.latitude,
      longitude: complaint.longitude,
      embedding: embeddingResult.embedding,
    });
    logger.info('Duplicate detection completed.', { complaintId, relatedCount: relatedResults.length });
  }

  const priority = priorityService.calculatePriority({
    category: analysis.category,
    severitySignals: analysis.severity_signals,
    relatedComplaintCount: relatedResults.length,
    createdAt: complaint.created_at,
  });

  const slaDeadline = slaService.calculateSlaDeadline(priority.level, new Date(complaint.created_at));

  await complaintModel.update(complaintId, {
    priority_score: priority.score,
    priority_level: priority.level,
    priority_reasons: JSON.stringify(priority.reasons),
    department_id: department?.id || null,
    sla_deadline: slaDeadline,
    sla_status: 'ON_TRACK',
  });

  const updatedComplaint = await complaintModel.findById(complaintId);

  if (!reviewRequired) {
    await statusService.transition(
      complaintId,
      COMPLAINT_STATUS.ASSIGNED,
      null,
      `Auto-routed to ${department?.name || 'General Administration'}.`,
      { force: true }
    );
  }

  let incidentInfo = { incidentId: null, relatedCount: relatedResults.length };
  try {
    incidentInfo = await incidentGroupingService.groupComplaintIntoIncident({
      complaint: updatedComplaint,
      relatedResults,
      departmentId: department?.id || null,
    });
    if (incidentInfo.incidentId) {
      logger.info('Complaint grouped into incident.', {
        complaintId,
        incidentId: incidentInfo.incidentId,
        relatedCount: incidentInfo.relatedCount,
      });
    }
  } catch (err) {
    logger.error('Incident grouping failed.', { complaintId, error: err.message });
  }

  if (department) {
    const officers = await require('../../models/user.model').listByRole('OFFICER');
    const deptOfficers = officers.filter((o) => o.department_id === department.id);
    for (const officer of deptOfficers) {
      await notificationService.notify({
        userId: officer.id,
        title: `New complaint assigned: ${complaint.complaint_number}`,
        message: `${analysis.category.replace(/_/g, ' ')} - priority ${priority.level}`,
        type: 'COMPLAINT_ASSIGNED',
        relatedComplaintId: complaintId,
      });
    }
  }

  return { ...(await complaintModel.findById(complaintId)), relatedCount: incidentInfo.relatedCount, incidentId: incidentInfo.incidentId };
}

module.exports = { runAnalysisPipeline };
