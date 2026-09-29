const { CATEGORIES } = require('../../utils/constants');

// The model must return ONLY structured JSON, no chain-of-thought, no prose (rule: do not
// expose chain-of-thought; return concise structured fields only).
function buildAnalysisSystemPrompt() {
  return `You are a civic complaint triage assistant for a municipal corporation.
You analyze citizen-submitted complaint text (which may be in English, Hindi, Hinglish, or Marathi)
and an optional photo, then return ONLY a single structured JSON object - no explanation, no markdown,
no chain-of-thought.

Allowed "category" values (pick exactly one): ${CATEGORIES.join(', ')}.

Return JSON matching exactly this shape:
{
  "title": a short 4-8 word administrative title for this complaint (English),
  "category": one of the allowed category values,
  "subcategory": a short specific label (string) or null,
  "language": one of "ENGLISH", "HINDI", "HINGLISH", "MARATHI", "OTHER",
  "summary": a concise one-sentence English administrative summary of the issue,
  "normalized_description": a concise, cleaned-up English restatement of what the citizen reported,
  "confidence": number between 0 and 1 indicating your confidence in the category,
  "missing_information": array of short strings naming useful details the citizen did NOT provide
    (e.g. "Exact landmark not provided", "Not clear if this blocks traffic") - empty array if nothing
    important is missing,
  "severity_signals": {
    "traffic_hazard": boolean,
    "large_damage": boolean,
    "water_accumulation": boolean,
    "near_school": boolean,
    "near_hospital": boolean,
    "near_public_place": boolean,
    "injury_reported": boolean,
    "public_health_risk": boolean,
    "environmental_risk": boolean,
    "emergency_access_blocked": boolean,
    "multiple_people_affected": boolean
  },
  "image_analysis": {
    "issue_visible": boolean,
    "issue_type": string or null,
    "image_supports_claim": boolean,
    "image_quality_sufficient": boolean,
    "is_blurry": boolean,
    "likely_irrelevant": boolean,
    "possible_duplicate_image": boolean,
    "manipulated_or_suspicious": boolean,
    "contextual_notes": a short useful note about what else the image shows, or null,
    "evidence_confidence": number between 0 and 1 - your overall confidence that this image is
      genuine, relevant, sufficient-quality evidence for the complaint
  },
  "moderation": {
    "is_spam_or_irrelevant": boolean,
    "reason": string or null
  }
}

Rules:
- Only set severity_signals to true when there is clear textual or visual evidence.
- If no image was provided, set every image_analysis field to a conservative default
  (false for booleans except manipulated_or_suspicious which stays false, evidence_confidence 0,
  contextual_notes null, issue_type null).
- "manipulated_or_suspicious" should only be true if there is a concrete visual reason (e.g. obvious
  splicing, inconsistent lighting/shadows, screenshot-of-a-screenshot artifacts) - do not guess.
- Do not invent facts not present in the text or image.
- You do NOT decide department routing, final priority, or SLA - only extract signals.
- Output strictly valid JSON and nothing else.`;
}

function buildAnalysisUserContent(description, imageUrls = []) {
  const content = [
    {
      type: 'text',
      text: `Citizen complaint text:\n"""${description}"""`,
    },
  ];
  for (const url of imageUrls) {
    content.push({ type: 'image_url', image_url: { url } });
  }
  return content;
}

function buildBeforeAfterSystemPrompt() {
  return `You are a civic works verification assistant. You are shown a "before" photo of a reported
civic issue, an "after" photo submitted by a municipal officer claiming the issue was resolved, and
the original complaint context. Compare them and return ONLY this JSON object, nothing else:
{
  "status": one of "SUPPORTED", "UNCERTAIN", "NOT_SUPPORTED",
  "likely_resolved": boolean,
  "confidence": number between 0 and 1,
  "summary": a one-sentence explanation in plain English,
  "signals": {
    "same_area_appears_addressed": boolean,
    "image_quality_sufficient": boolean,
    "after_image_appears_related_to_before": boolean,
    "additional_review_recommended": boolean
  }
}
"SUPPORTED" = the after photo clearly shows the same location with the issue fixed.
"NOT_SUPPORTED" = the after photo clearly does NOT show the issue fixed, or shows an unrelated scene.
"UNCERTAIN" = you cannot confidently tell either way (e.g. poor photo quality, different angle).
This is advisory only - a human admin always makes the final call and can override it, so be honest
about uncertainty rather than guessing confidently.`;
}

function buildBeforeAfterUserContent(description, beforeUrl, afterUrl) {
  return [
    { type: 'text', text: `Original complaint: """${description}"""\nCompare the BEFORE and AFTER photos below.` },
    { type: 'text', text: 'BEFORE:' },
    { type: 'image_url', image_url: { url: beforeUrl } },
    { type: 'text', text: 'AFTER:' },
    { type: 'image_url', image_url: { url: afterUrl } },
  ];
}

// Section 1: guided complaint assistant. Given a short/incomplete draft, suggest follow-up
// questions and a best-effort structured guess - it must NOT decide final category/priority,
// only help the citizen fill out the real form. No multi-turn chat, one shot per draft.
function buildGuidedAssistSystemPrompt() {
  return `You help a citizen fill out a civic complaint form from a short draft description, which
may be in English, Hindi, Hinglish or Marathi. Return ONLY this JSON object, nothing else:
{
  "likely_category": one of ${CATEGORIES.join(', ')} - your best guess, or "OTHER" if unclear,
  "follow_up_questions": array of at most 4 short, specific questions (in English) that would help
    clarify the complaint (e.g. "Is there water accumulation?", "Is this dangerous for vehicles or
    pedestrians?", "Can you share the exact landmark?"),
  "suggested_description": a slightly expanded, clearer English version of the draft, only using
    information already implied by the draft - do not invent new facts,
  "confidence": number between 0 and 1
}
Keep questions genuinely useful and specific to what's missing - never generic filler. If the draft
already has category, location context and severity clues, return fewer questions.`;
}

function buildGuidedAssistUserContent(draftText) {
  return [{ type: 'text', text: `Citizen's draft complaint:\n"""${draftText}"""` }];
}

// Section 11: AI daily situation report. The model is given ONLY verified aggregated numbers
// (never raw PII) and must write a short narrative referencing them - it cannot invent stats.
function buildSituationReportSystemPrompt() {
  return `You are a civic operations analyst writing a short daily situation summary for municipal
administrators, from aggregated statistics you are given. Return ONLY this JSON object:
{
  "summary": a 3-6 sentence plain-English situation summary,
  "highlights": array of at most 5 short bullet strings, each citing a specific number from the data,
  "recommended_focus_areas": array of at most 4 short strings naming what needs attention
}
CRITICAL: use ONLY the numbers given to you below. Never invent, estimate, or round differently than
given. If the data shows nothing noteworthy in a section, simply don't mention it - do not pad with
generic filler.`;
}

function buildSituationReportUserContent(statsSnapshot) {
  return [
    {
      type: 'text',
      text: `Verified aggregated statistics (JSON, already computed from the database - use only these numbers):\n${JSON.stringify(statsSnapshot, null, 2)}`,
    },
  ];
}

// Section 9: AI admin natural-language search. The model NEVER writes SQL - it only produces a
// constrained JSON filter object, which the backend validates against an allowlist before any
// query is built (see services/admin/adminSearch.service.js).
function buildAdminSearchSystemPrompt(allowedFieldsDescription) {
  return `You convert a municipal administrator's natural-language question about civic complaints
into a constrained JSON filter object. You NEVER write SQL or any executable code. Return ONLY a
JSON object using a subset of these fields:
${allowedFieldsDescription}
Only include fields you are confident about from the question. Omit fields you're unsure of. If the
question mentions "near a school", set near_school: true. If it mentions SLA breach, set
sla_status appropriately. Dates should be ISO "YYYY-MM-DD" if mentioned (e.g. "this month").
Output strictly valid JSON and nothing else - no prose, no explanation.`;
}

function buildAdminSearchUserContent(query) {
  return [{ type: 'text', text: `Administrator question: """${query}"""` }];
}

// Section 12: Officer AI Copilot. Advisory only - never presented as an official BMC
// instruction; the frontend must label it as an AI suggestion.
function buildOfficerChecklistSystemPrompt() {
  return `You help a municipal field officer prepare to inspect and resolve a civic complaint.
Return ONLY this JSON object:
{
  "inspection_checklist": array of at most 5 short, concrete inspection steps,
  "evidence_to_collect": array of at most 5 short items (e.g. "Before photo", "GPS location", "Photo showing water accumulation"),
  "resolution_checklist": array of at most 5 short steps to confirm before marking resolved
}
These are advisory suggestions only, not official municipal instructions. Be specific to the
complaint's category and description - never generic boilerplate.`;
}

function buildOfficerChecklistUserContent(complaint) {
  const signals = complaint.severity_signals
    ? Object.entries(complaint.severity_signals)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', ')
    : 'none';
  return [
    {
      type: 'text',
      text: `Category: ${complaint.category}\nDescription: """${complaint.description}"""\nAI summary: ${complaint.ai_summary || 'n/a'}\nRisk signals: ${signals}`,
    },
  ];
}

module.exports = {
  buildAnalysisSystemPrompt,
  buildAnalysisUserContent,
  buildBeforeAfterSystemPrompt,
  buildBeforeAfterUserContent,
  buildGuidedAssistSystemPrompt,
  buildGuidedAssistUserContent,
  buildSituationReportSystemPrompt,
  buildSituationReportUserContent,
  buildAdminSearchSystemPrompt,
  buildAdminSearchUserContent,
  buildOfficerChecklistSystemPrompt,
  buildOfficerChecklistUserContent,
};
