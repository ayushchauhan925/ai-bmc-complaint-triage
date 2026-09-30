const { EVIDENCE } = require('../../utils/constants');

/**
 * Evidence intelligence: a deterministic, auditable 0-100 score for how well-supported a
 * complaint is, built from concrete signals - never from a free-form LLM opinion. Signals
 * that do not apply (e.g. image quality when there is no photo) are excluded from the
 * denominator rather than counted as zero, so a text-only complaint is not double-penalised
 * for the absence of a photo (that absence is its own, visible signal).
 *
 * Output signals are the "decision factors" shown to staff. No hidden reasoning is stored.
 */

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function signal(key, label, points, max, detail, extra = {}) {
  const status = extra.status || (points >= max * 0.6 ? 'positive' : points > 0 ? 'neutral' : 'negative');
  return { key, label, points, max, applicable: extra.applicable !== false, status, detail };
}

/**
 * @param {object} input
 * @param {string} input.description
 * @param {string|null} input.address
 * @param {Array}  input.images                    complaint_images rows (may carry blur_score, width, height)
 * @param {object|null} input.ai                   validated AI analysis (null if AI failed)
 * @param {Array}  input.related                   related complaint results [{semanticScore, combinedScore, distanceMeters, complaint:{created_at}}]
 * @param {number} input.historyRepeatCount        earlier same-category complaints near this spot
 * @param {boolean} input.injectionSuspected
 */
function computeEvidence({
  description,
  address = null,
  images = [],
  ai = null,
  related = [],
  historyRepeatCount = 0,
  injectionSuspected = false,
  now = Date.now(),
}) {
  const W = EVIDENCE.weights;
  const signals = [];
  const hasImages = images.length > 0;

  // 1. Text quality: enough concrete detail to act on.
  const words = wordCount(description);
  const textPts = words >= 25 ? W.text : words >= 12 ? Math.round(W.text * 0.7) : words >= 6 ? Math.round(W.text * 0.35) : 1;
  signals.push(signal('text_quality', 'Description detail', ai?.moderation?.is_spam_or_irrelevant ? 0 : textPts, W.text, `${words} words`));

  // 2. Location completeness: a typed address/landmark plus the AI's read of the text.
  const hasAddress = Boolean(address && address.trim().length >= 6);
  const relevance = ai?.location_relevance;
  const locPts =
    (hasAddress ? Math.round(W.location * 0.5) : 0) +
    (relevance === 'CLEAR' ? Math.round(W.location * 0.5) : relevance === 'VAGUE' ? Math.round(W.location * 0.2) : 0);
  signals.push(
    signal('location', 'Location detail', locPts, W.location, hasAddress ? 'Address/landmark provided' : 'Only map pin provided')
  );

  // 3. Photo attached.
  signals.push(
    signal('image_available', 'Photo evidence attached', hasImages ? W.imageAvailable : 0, W.imageAvailable, hasImages ? `${images.length} photo(s)` : 'No photo')
  );

  // 4/5. Image quality + relevance - only meaningful when there is a photo.
  if (hasImages) {
    const measured = images.filter((i) => i.blur_score !== null && i.blur_score !== undefined);
    const localBlurry = measured.length > 0 && measured.every((i) => Number(i.blur_score) < EVIDENCE.blurThreshold);
    const localSharp = measured.some((i) => Number(i.blur_score) >= EVIDENCE.blurThreshold);
    const aiImg = ai?.image_analysis;
    let qualityPts = 0;
    let qualityDetail = 'Image quality not assessed';
    if (aiImg) {
      qualityPts = aiImg.image_quality_sufficient && !aiImg.is_blurry ? W.imageQuality : aiImg.image_quality_sufficient ? Math.round(W.imageQuality * 0.5) : 0;
      qualityDetail = aiImg.is_blurry ? 'AI reports a blurry image' : aiImg.image_quality_sufficient ? 'AI reports usable quality' : 'AI reports insufficient quality';
    }
    if (measured.length > 0) {
      // Local measurement can only downgrade a generous AI view or fill in when AI is unavailable.
      if (localBlurry) {
        qualityPts = Math.min(qualityPts || W.imageQuality, Math.round(W.imageQuality * 0.3));
        qualityDetail = 'Photo measured as blurry (local analysis)';
      } else if (!aiImg && localSharp) {
        qualityPts = Math.round(W.imageQuality * 0.7);
        qualityDetail = 'Photo measured as sharp (local analysis)';
      }
    }
    signals.push(signal('image_quality', 'Photo quality', qualityPts, W.imageQuality, qualityDetail));

    if (aiImg) {
      const supportsPts = aiImg.image_supports_claim ? Math.round(W.imageSupports * Math.min(1, Math.max(0.4, aiImg.evidence_confidence || 0.5))) : 0;
      signals.push(
        signal(
          'image_supports_claim',
          'Photo matches complaint',
          supportsPts,
          W.imageSupports,
          aiImg.image_supports_claim ? 'AI: photo consistent with the description' : 'AI: photo does not clearly support the description',
          { status: aiImg.image_supports_claim ? undefined : 'negative' }
        )
      );
    } else {
      signals.push(signal('image_supports_claim', 'Photo matches complaint', 0, W.imageSupports, 'Photo not analysed by AI', { applicable: false }));
    }
  } else {
    signals.push(signal('image_quality', 'Photo quality', 0, W.imageQuality, 'No photo', { applicable: false }));
    signals.push(signal('image_supports_claim', 'Photo matches complaint', 0, W.imageSupports, 'No photo', { applicable: false }));
  }

  // 6. AI classification confidence (only when the AI actually answered).
  if (ai) {
    signals.push(signal('ai_confidence', 'AI classification confidence', Math.round(W.aiConfidence * ai.confidence), W.aiConfidence, `${Math.round(ai.confidence * 100)}%`));
  } else {
    signals.push(signal('ai_confidence', 'AI classification confidence', 0, W.aiConfidence, 'AI analysis unavailable', { applicable: false }));
  }

  // 7. Corroboration: independent similar reports nearby.
  const n = related.length;
  const corrPts = n >= 3 ? W.corroboration : n === 2 ? Math.round(W.corroboration * 0.66) : n === 1 ? Math.round(W.corroboration * 0.4) : 0;
  signals.push(
    signal('corroboration', 'Corroborating reports', corrPts, W.corroboration, n ? `${n} similar complaint(s) nearby` : 'No similar complaints found')
  );

  // 8. Historical pattern at this location.
  signals.push(
    signal('history', 'Recurring location', historyRepeatCount > 0 ? W.history : 0, W.history, historyRepeatCount > 0 ? `${historyRepeatCount} earlier report(s) here` : 'No earlier reports here')
  );

  // 9. Temporal consistency: corroborating reports that are recent relative to each other.
  const recentHours = EVIDENCE.recentCorroborationHours;
  const recentRelated = related.filter((r) => now - new Date(r.complaint.created_at).getTime() <= recentHours * 3600 * 1000).length;
  const temporalPts = recentRelated >= 2 ? W.temporal : recentRelated === 1 ? Math.round(W.temporal * 0.6) : 0;
  signals.push(
    signal('temporal', 'Recent corroboration', temporalPts, W.temporal, recentRelated ? `${recentRelated} report(s) within ${recentHours}h` : `No reports within ${recentHours}h`)
  );

  // Penalties (concrete red flags, shown as negative signals).
  let penalty = 0;
  const redFlags = [];
  if (ai?.image_analysis?.manipulated_or_suspicious && hasImages) {
    penalty += EVIDENCE.penalties.manipulated;
    redFlags.push({ key: 'manipulated_image', label: 'Possible image manipulation', points: -EVIDENCE.penalties.manipulated });
  }
  if (ai?.image_analysis?.likely_irrelevant && hasImages) {
    penalty += EVIDENCE.penalties.irrelevantImage;
    redFlags.push({ key: 'irrelevant_image', label: 'Photo may be unrelated', points: -EVIDENCE.penalties.irrelevantImage });
  }
  if (injectionSuspected) {
    penalty += EVIDENCE.penalties.injection;
    redFlags.push({ key: 'prompt_injection', label: 'Text contains instruction-like content', points: -EVIDENCE.penalties.injection });
  }

  const applicable = signals.filter((s) => s.applicable);
  const earned = applicable.reduce((sum, s) => sum + s.points, 0);
  const possible = applicable.reduce((sum, s) => sum + s.max, 0) || 1;
  const score = Math.max(0, Math.min(100, Math.round((earned / possible) * 100) - penalty));

  const band = score >= EVIDENCE.bands.strong ? 'STRONG' : score >= EVIDENCE.bands.moderate ? 'MODERATE' : score >= EVIDENCE.bands.weak ? 'WEAK' : 'INSUFFICIENT';

  // Concise human-readable indicators (auditable facts, no reasoning text).
  const indicators = [];
  if (locPts >= W.location * 0.7) indicators.push('Strong location evidence');
  else if (locPts <= W.location * 0.25) indicators.push('Limited location detail');
  if (hasImages) indicators.push('Photo attached');
  if (n > 0) indicators.push(`${n} similar complaint${n > 1 ? 's' : ''} nearby`);
  if (ai && ai.confidence >= 0.8) indicators.push('High semantic confidence');
  if (ai && ai.confidence < 0.5) indicators.push('Low semantic confidence');
  if (recentRelated > 0) indicators.push('Corroborated by recent reports');
  if (historyRepeatCount > 0) indicators.push('Issue has recurred at this location');
  for (const f of redFlags) indicators.push(f.label);

  return { score, band, signals, redFlags, indicators, penalty, earned, possible };
}

module.exports = { computeEvidence };
