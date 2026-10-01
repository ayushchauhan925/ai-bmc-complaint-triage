const complaintModel = require('../../models/complaint.model');
const decisionModel = require('../../models/decision.model');
const duplicateModel = require('../../models/duplicate.model');
const userModel = require('../../models/user.model');
const statusService = require('./status.service');
const routingService = require('./routing.service');
const slaService = require('./sla.service');
const slaPolicyService = require('./slaPolicy.service');
const timeline = require('./timeline.service');
const complaintAnalysisService = require('../ai/complaintAnalysis.service');
const embeddingService = require('../ai/embedding.service');
const duplicateDetectionService = require('../duplicate/duplicateDetection.service');
const incidentGroupingService = require('../duplicate/incidentGrouping.service');
const imageIntelligence = require('../image/imageIntelligence.service');
const evidenceService = require('../decision/evidence.service');
const decisionEngine = require('../decision/decisionEngine.service');
const notificationService = require('../notification/notification.service');
const auditService = require('../audit/audit.service');
const metrics = require('../observability/metrics.service');
const logger = require('../../utils/logger');
const { COMPLAINT_STATUS, DECISION_ENGINE, DUPLICATE_DETECTION } = require('../../utils/constants');

const { EVENT_TYPES } = timeline;

/** Runs a non-essential enrichment step; a failure degrades the result instead of failing the pipeline. */
async function optional(label, complaintId, fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    metrics.recordError('api', `pipeline step "${label}" failed: ${err.message}`, { complaintId });
    logger.warn(`Pipeline step "${label}" failed; continuing without it.`, { complaintId, error: err.message });
    return fallback;
  }
}

/**
 * Image-derived review reasons from the vision model's assessment (unchanged rules from the
 * original pipeline). These are inputs to the decision engine, never decisions themselves.
 */
function imageReviewReasons(hasImages, evidence) {
  const reasons = [];
  if (!hasImages) return reasons;
  if (!evidence.image_supports_claim) reasons.push('Uploaded image does not clearly support the complaint text.');
  if (evidence.likely_irrelevant) reasons.push('Uploaded image may be unrelated to the reported issue.');
  if (evidence.manipulated_or_suspicious) reasons.push('Uploaded image shows possible signs of manipulation.');
  if (!evidence.image_quality_sufficient || evidence.is_blurry) {
    reasons.push('Uploaded image quality may be insufficient to verify the claim.');
  }
  return reasons;
}

/**
 * Turns a photo that matches an earlier complaint's photo at (nearly) the same place into a
 * related-complaint candidate even when the text did not match - the same picture at the same
 * spot is strong duplicate evidence.
 */
async function imageOnlyCandidates(sameSpot, complaint, existingIds, category) {
  const out = [];
  for (const m of sameSpot) {
    if (existingIds.has(m.complaintId)) continue;
    const other = await complaintModel.findById(m.complaintId);
    if (!other) continue;
    const categoryMatch = duplicateDetectionService.sameCategoryFamily(category, other.category);
    const probability = Math.max(0.65, duplicateDetectionService.duplicateProbability({
      semanticScore: null, textScore: 0, distanceScore: 1 - m.distanceMeters / DUPLICATE_DETECTION.searchRadiusMeters,
      timeScore: 0.5, categoryMatch, imageSimilarity: m.similarity,
    }));
    out.push({
      complaint: other,
      semanticScore: 0,
      textScore: 0,
      distanceMeters: m.distanceMeters,
      combinedScore: m.similarity,
      categoryMatch,
      duplicateProbability: Number(probability.toFixed(3)),
      method: 'image',
      imageSimilarity: Number(m.similarity.toFixed(3)),
      indicators: ['Visually similar photo', `${m.distanceMeters} m away`, categoryMatch === false ? 'Different category' : 'Compatible category'],
    });
  }
  return out;
}

/**
 * Full AI -> evidence -> hybrid-decision pipeline for a complaint:
 *
 *   AI understanding (structured, validated) -> embeddings -> duplicate/related detection
 *   (+ image similarity) -> evidence score -> hybrid decision (priority, review gates) ->
 *   deterministic routing + SLA -> incident grouping -> notifications, timeline, audit.
 *
 * Never throws for AI failure: the complaint is preserved, given a rule-based fallback
 * classification/priority/department/SLA, flagged for manual review, and retried later by
 * the background job. A human-corrected complaint is not overwritten unless `force` is set.
 */
async function runAnalysisPipeline(complaintId, { force = false } = {}) {
  const complaint = await complaintModel.findById(complaintId);
  if (!complaint) return;

  if (complaint.review_status === 'CORRECTED' && !force) {
    logger.info('Skipping re-analysis: complaint carries a human correction.', { complaintId });
    return complaintModel.findById(complaintId);
  }

  logger.info('AI analysis started.', { complaintId, complaintNumber: complaint.complaint_number });
  await complaintModel.update(complaintId, { ai_attempts: Math.min((complaint.ai_attempts || 0) + 1, 250) });

  const images = await complaintModel.getImages(complaintId);
  const originalImages = images.filter((img) => img.image_type === 'ORIGINAL');
  const imageUrls = originalImages.map((img) => img.image_url);
  const hasImages = imageUrls.length > 0;

  const analysisResult = await complaintAnalysisService.analyzeComplaint({
    description: complaint.description,
    imageUrls,
  });

  const aiOk = analysisResult.success;
  const analysis = aiOk ? analysisResult.analysis : null;
  const injectionSuspected = Boolean(analysisResult.safety?.injectionSuspected);
  const category = analysis ? analysis.category : complaint.category || 'OTHER';

  if (aiOk) {
    // Persist the AI understanding immediately so it survives a later failure.
    await complaintModel.update(complaintId, {
      ai_title: analysis.title,
      category: analysis.category,
      subcategory: analysis.subcategory,
      language: analysis.language,
      ai_summary: analysis.summary,
      ai_confidence: analysis.confidence,
      missing_information: JSON.stringify(analysis.missing_information || []),
      severity_signals: JSON.stringify(analysis.severity_signals),
      evidence_analysis: hasImages ? JSON.stringify(analysis.image_analysis) : null,
      evidence_confidence: hasImages ? analysis.image_analysis.evidence_confidence : null,
      image_verified: hasImages ? analysis.image_analysis.image_supports_claim : null,
      ai_analysis_failed: false,
    });
    await timeline.recordEvent(complaintId, EVENT_TYPES.AI_ANALYZED, 'AI analysed the complaint', {
      details: { category: analysis.category, confidence: analysis.confidence, urgency: analysis.urgency, language: analysis.language },
    });
  } else {
    logger.warn('AI analysis failed; applying rule-based fallback and flagging for manual review.', {
      complaintId,
      reason: analysisResult.failureReason,
    });
    await complaintModel.update(complaintId, { ai_analysis_failed: true });
    await timeline.recordEvent(complaintId, EVENT_TYPES.AI_FAILED, 'AI analysis unavailable - fallback applied', {
      details: { reason: analysisResult.failureReason },
    });
  }

  // Routing is deterministic on the (validated) category; "OTHER" -> General Administration.
  const routing = await routingService.routeWithSecondary(category);
  const department = routing.primary || routing.secondary[0] || null;

  // Embedding + related-complaint detection (degrades to text-only matching without embeddings).
  const embeddingText = `${analysis?.summary || ''} ${complaint.description}`.trim();
  const embeddingResult = await optional('embedding', complaintId, () => embeddingService.generateAndStoreEmbedding(complaintId, embeddingText), { success: false });

  let relatedResults = await optional(
    'duplicate-detection',
    complaintId,
    () =>
      duplicateDetectionService.findRelatedComplaints({
        complaintId,
        description: complaint.description,
        category,
        latitude: Number(complaint.latitude),
        longitude: Number(complaint.longitude),
        embedding: embeddingResult.success ? embeddingResult.embedding : null,
        allowTextFallback: true,
      }),
    []
  );

  // Image intelligence: photo similarity to related complaints, and reuse detection.
  const phashes = originalImages.map((i) => i.phash).filter(Boolean);
  let imageReuseElsewhere = [];
  if (phashes.length > 0) {
    await optional('image-similarity', complaintId, async () => {
      const simMap = await imageIntelligence.similarityToCandidates(phashes, relatedResults.map((r) => r.complaint.id));
      duplicateDetectionService.applyImageSimilarity(relatedResults, simMap);
      const matches = await imageIntelligence.findSimilarImages({ phashes, excludeComplaintId: complaintId });
      const { sameSpot, elsewhere } = imageIntelligence.classifyReuse(matches, Number(complaint.latitude), Number(complaint.longitude));
      imageReuseElsewhere = elsewhere;
      const extra = await imageOnlyCandidates(sameSpot, complaint, new Set(relatedResults.map((r) => r.complaint.id)), category);
      relatedResults = [...relatedResults, ...extra];
    }, undefined);
  }
  relatedResults.sort((a, b) => b.duplicateProbability - a.duplicateProbability);

  if (relatedResults.length > 0) {
    await optional('persist-duplicates', complaintId, () => duplicateModel.upsertSuggestions(complaintId, relatedResults), undefined);
    await timeline.recordEvent(complaintId, EVENT_TYPES.DUPLICATE_DETECTED, `${relatedResults.length} similar complaint(s) found nearby`, {
      details: {
        related: relatedResults.slice(0, 5).map((r) => ({
          complaintNumber: r.complaint.complaint_number,
          probability: r.duplicateProbability,
          distanceMeters: Math.round(r.distanceMeters),
          method: r.method,
        })),
      },
    });
  }
  logger.info('Duplicate detection completed.', { complaintId, relatedCount: relatedResults.length });

  // Only strong, category-compatible matches count as the *same issue* (corroboration and
  // duplicate volume); merely-nearby different-category complaints stay as "related".
  const corroborating = duplicateDetectionService.linkableResults(relatedResults);

  // Evidence + hybrid decision.
  const historyRepeatCount = await optional(
    'history',
    complaintId,
    () =>
      complaintModel.countHistoricalNearby({
        latitude: Number(complaint.latitude),
        longitude: Number(complaint.longitude),
        category,
        radiusMeters: DECISION_ENGINE.repeatLocation.radiusMeters,
        days: DECISION_ENGINE.repeatLocation.days,
        excludeId: complaintId,
      }),
    0
  );

  const evidence = evidenceService.computeEvidence({
    description: complaint.description,
    address: complaint.address,
    images: originalImages,
    ai: analysis,
    related: corroborating,
    historyRepeatCount,
    injectionSuspected,
  });

  const externalReviewReasons = analysis ? imageReviewReasons(hasImages, analysis.image_analysis) : [];
  if (imageReuseElsewhere.length > 0) {
    externalReviewReasons.push(`A photo matches an earlier complaint (${imageReuseElsewhere[0].complaintNumber}) filed at a different location.`);
  }

  const decision = decisionEngine.decide({
    category,
    ai: analysis,
    evidence,
    relatedCount: corroborating.length,
    historyRepeatCount,
    createdAt: complaint.created_at,
    externalReviewReasons,
    injectionSuspected,
  });

  const policy = await slaPolicyService.resolvePolicy(decision.priority.level, category);
  const slaDeadline = slaService.calculateSlaDeadline(decision.priority.level, new Date(complaint.created_at), policy.hours);

  await complaintModel.update(complaintId, {
    priority_score: decision.priority.score,
    priority_level: decision.priority.level,
    priority_reasons: JSON.stringify(decision.priorityReasons),
    department_id: department?.id || null,
    sla_deadline: slaDeadline,
    sla_hours: policy.hours,
    sla_status: 'ON_TRACK',
    review_required: decision.humanReviewRequired,
    review_reason: decision.reviewReasons.join(' ').slice(0, 255) || null,
  });

  await decisionModel.upsert(complaintId, {
    engineVersion: decision.engineVersion,
    aiOutput: analysis,
    evidenceScore: evidence.score,
    evidenceBand: evidence.band,
    evidenceSignals: { signals: evidence.signals, redFlags: evidence.redFlags, indicators: evidence.indicators },
    decisionFactors: decision.factors,
    basePriorityScore: decision.priority.baseScore,
    finalPriorityScore: decision.priority.score,
    finalPriorityLevel: decision.priority.level,
    humanReviewRequired: decision.humanReviewRequired,
    reviewReasons: decision.reviewReasons,
  });

  await timeline.recordEvent(complaintId, EVENT_TYPES.EVIDENCE_SCORED, `Evidence score ${evidence.score}/100 (${evidence.band.toLowerCase()})`, {
    details: { indicators: evidence.indicators },
  });
  await timeline.recordEvent(complaintId, EVENT_TYPES.PRIORITY_SET, `Priority ${decision.priority.level} (score ${decision.priority.score})`, {
    details: { factors: decision.factors.filter((f) => f.points !== 0).slice(0, 8), slaHours: policy.hours },
  });

  // Status transitions, in the original order.
  if (aiOk) {
    await statusService.transition(complaintId, COMPLAINT_STATUS.AI_ANALYZED, null, 'AI analysis complete.', { force: true });
    logger.info('AI analysis completed.', { complaintId, category, confidence: analysis.confidence, reviewRequired: decision.humanReviewRequired });
  }

  if (decision.humanReviewRequired) {
    if (!aiOk && complaint.status !== COMPLAINT_STATUS.NEEDS_REVIEW) {
      await statusService.transition(complaintId, COMPLAINT_STATUS.NEEDS_REVIEW, null, 'AI analysis failed. Flagged for manual review.', { force: true });
    }
  } else {
    await statusService.transition(
      complaintId,
      COMPLAINT_STATUS.ASSIGNED,
      null,
      `Auto-routed to ${department?.name || 'General Administration'}.`,
      { force: true }
    );
  }
  await timeline.recordEvent(complaintId, EVENT_TYPES.DEPARTMENT_ASSIGNED, `Routed to ${department?.name || 'General Administration'}`, {
    details: {
      departmentId: department?.id || null,
      category,
      secondaryDepartments: routing.secondary.map((d) => d.name),
      usedFallback: routing.usedFallback,
    },
  });

  // Incident grouping: only strong, category-compatible matches join an incident.
  const updatedComplaint = await complaintModel.findById(complaintId);
  let incidentInfo = { incidentId: null, relatedCount: relatedResults.length };
  try {
    incidentInfo = await incidentGroupingService.groupComplaintIntoIncident({
      complaint: updatedComplaint,
      relatedResults: corroborating,
      departmentId: department?.id || null,
    });
    incidentInfo.relatedCount = relatedResults.length;
    if (incidentInfo.incidentId) {
      logger.info('Complaint grouped into incident.', { complaintId, incidentId: incidentInfo.incidentId, relatedCount: relatedResults.length });
      await timeline.recordEvent(complaintId, EVENT_TYPES.INCIDENT_LINKED, 'Linked to a reported incident with similar complaints', {
        details: { incidentId: incidentInfo.incidentId },
        visibility: 'PUBLIC',
      });
    }
  } catch (err) {
    metrics.recordError('api', `incident grouping failed: ${err.message}`, { complaintId });
    logger.error('Incident grouping failed.', { complaintId, error: err.message });
  }

  if (department) {
    const officers = await userModel.listByRole('OFFICER');
    for (const officer of officers.filter((o) => o.department_id === department.id)) {
      await notificationService.notify({
        userId: officer.id,
        title: `New complaint assigned: ${complaint.complaint_number}`,
        message: `${category.replace(/_/g, ' ')} - priority ${decision.priority.level}`,
        type: 'COMPLAINT_ASSIGNED',
        relatedComplaintId: complaintId,
      });
    }
  }

  await auditService.record({
    actor: null,
    action: aiOk ? 'AI_ANALYSIS_COMPLETED' : 'AI_ANALYSIS_FALLBACK',
    entityType: 'complaint',
    entityId: complaintId,
    next: {
      category,
      priority: decision.priority.level,
      priorityScore: decision.priority.score,
      departmentId: department?.id || null,
      evidenceScore: evidence.score,
      confidence: analysis?.confidence ?? null,
      humanReviewRequired: decision.humanReviewRequired,
      engineVersion: decision.engineVersion,
    },
  });

  return {
    ...(await complaintModel.findById(complaintId)),
    relatedCount: incidentInfo.relatedCount,
    incidentId: incidentInfo.incidentId,
  };
}

module.exports = { runAnalysisPipeline };
